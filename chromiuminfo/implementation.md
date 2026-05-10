# Реализация Fast-Forward Seek: детальное описание патча

> **Контекст:** Патч [patches/3.patch](../patches/3.patch) реализует «быстрый» путь seeking для `HTMLVideoElement` в Chromium.  
> **Проблема:** [issue.md](./issue.md) | **Архитектура:** [archtecture.md](./archtecture.md) | **Ограничения:** [seek-limitation-and-safari.md](./seek-limitation-and-safari.md)

---

## Суть оптимизации

Стандартный путь seek в Chromium выглядит так:

```
Seek(time) → AbortPendingReads → Flush (сброс декодера) → av_seek_frame → FlushBuffers → перечитать с keyframe
```

Каждая операция seek сбрасывает декодер «до нуля», даже если цель находится в уже прочитанном буфере. При покадровом просмотре (N seek-операций подряд) это даёт сложность **O(n)** на каждый шаг и **O(n²)** суммарно.

Патч добавляет **fast-forward путь**: если цель находится впереди и данные уже буферизованы — декодер **не сбрасывается**, старые кадры просто отбрасываются из очереди.

```
Seek(time) → [проверка условий] → FastForwardTo → discard old frames → готово
```

---

## Изменённые файлы и их роли

### 1. `media/base/demuxer.h/.cc` — новый метод `ShouldFastForward()`

```cpp
// Добавлен в Demuxer (базовый класс):
virtual bool ShouldFastForward(base::TimeDelta media_time) const;
// По умолчанию: return false — существующие реализации не затронуты.
```

Демультиплексор сообщает: «у меня есть данные для этого времени без необходимости в av_seek_frame».

---

### 2. `media/base/renderer.h/.cc` — новые методы `SupportsFastForward()` / `FastForwardTo()`

```cpp
virtual bool SupportsFastForward(base::TimeDelta media_time) const; // default: false
virtual void FastForwardTo(base::TimeDelta media_time,
                           PipelineStatusCallback seek_done_cb);    // default: NOTREACHED
```

Базовый класс `Renderer` получает виртуальные методы — безопасно для всех унаследованных реализаций.

---

### 3. `media/base/audio_renderer.h` / `media/base/video_renderer.h` — интерфейсы рендереров

В оба интерфейса добавлен чисто виртуальный `FastForwardTo()`:

```cpp
virtual void FastForwardTo(base::TimeDelta time, base::OnceClosure callback) = 0;
```

---

### 4. `media/base/pipeline_impl.cc` — точка принятия решения ⭐

Это **ключевое изменение**. В `RendererWrapper::Seek()` добавлена проверка перед стандартным путём:

```cpp
void PipelineImpl::RendererWrapper::Seek(base::TimeDelta time) {
  // ...
  Renderer* renderer = shared_state_.media().renderer.get();

  if (seek_timestamp >= renderer->GetMediaTime() &&       // шаг вперёд
      demuxer_->ShouldFastForward(seek_timestamp) &&      // данные есть
      renderer->SupportsFastForward(seek_timestamp)) {    // рендерер готов

    renderer->FastForwardTo(
        seek_timestamp,
        base::BindOnce(&RendererWrapper::CompleteFastForwardSeek, ...));
    return;  // ← стандартный путь (Flush + av_seek_frame) НЕ выполняется
  }

  // Стандартный путь: AbortPendingReads → Flush → Seek demuxer
  // ...
}
```

**Три условия для fast-forward:**
1. Цель **впереди** текущей позиции (`seek_timestamp >= renderer->GetMediaTime()`)
2. Демультиплексор подтверждает: данные **в буфере** (`ShouldFastForward`)
3. Рендерер **в состоянии** playing (`SupportsFastForward`)

Добавлен `CompleteFastForwardSeek()` — аналог `CompleteSeek()`, но без этапов Flush и StartPlayingFrom:

```cpp
void PipelineImpl::RendererWrapper::CompleteFastForwardSeek(...) {
  // Рендерер уже играет — не нужен Flush/StartPlayingFrom
  shared_state_.media().renderer->SetPlaybackRate(playback_rate_);
  SetState(State::kPlaying);
  main_task_runner_->PostTask(FROM_HERE,
      base::BindOnce(&PipelineImpl::OnSeekDone, weak_pipeline_, false));
}
```

---

### 5. `media/filters/ffmpeg_demuxer.cc/.h` — реализация `ShouldFastForward()`

```cpp
bool FFmpegDemuxer::ShouldFastForward(base::TimeDelta media_time) const {
  const FFmpegDemuxerStream* ref_stream = /* предпочтительно видео, иначе аудио */;

  // Условие 1: цель уже в буферизованных диапазонах
  const Ranges<base::TimeDelta> ranges = ref_stream->GetBufferedRanges();
  if (media_time >= buffer_start && media_time <= buffer_end)
    return true;

  // Условие 2: цель недалеко впереди read-head (≤ 2 секунд)
  const base::TimeDelta last_read = ref_stream->GetLastPacketTimestamp();
  if (media_time < last_read)
    return false;  // backward seek → невозможен без av_seek_frame

  constexpr base::TimeDelta kMaxLookahead = base::Seconds(2);
  return (media_time - last_read) <= kMaxLookahead;
}
```

Также добавлен `FFmpegDemuxerStream::GetLastPacketTimestamp()` — возвращает timestamp последнего пакета, поставленного в очередь FFmpeg. Это позволяет знать, как далеко «прочитал» демультиплексор.

---

### 6. `media/filters/decoder_stream.cc/.h` — `FastForwardTo()` без сброса декодера

`DecoderStream<T>` управляет очередью уже декодированных выходных кадров. Метод `FastForwardTo()` отбрасывает устаревшие кадры **без** вызова `Reset()`:

```cpp
void DecoderStream<StreamType>::FastForwardTo(base::TimeDelta target_time) {
  // Для видео: порог отбрасывания = target_time - среднее_время_кадра
  // (чтобы оставить хотя бы один кадр рядом с целью)
  base::TimeDelta drop_before_timestamp = target_time - AverageDuration();

  // Убираем устаревшие кадры из очередей ready_outputs_ и unprepared_outputs_
  while (!ready_outputs_.empty() &&
         ready_outputs_.front()->timestamp() < drop_before_timestamp)
    ready_outputs_.pop_front();

  // Устанавливаем фильтр: in-flight кадры (уже в декодировании)
  // тоже будут отброшены в OnDecodeOutputReady()
  drop_before_timestamp_ = drop_before_timestamp;
  skip_prepare_until_timestamp_ = target_time;
}
```

Поле `drop_before_timestamp_` сбрасывается при полном `Reset()` декодера (стандартный seek), чтобы не мешать обычному воспроизведению.

---

### 7. `media/filters/video_renderer_algorithm.cc/.h` — управление очередью кадров

Добавлены три метода для `VideoRendererAlgorithm` (очередь готовых видеокадров):

#### `DiscardFramesBefore(time)` — отбросить устаревшие кадры

```cpp
void VideoRendererAlgorithm::DiscardFramesBefore(base::TimeDelta time) {
  // Сохраняет хотя бы один кадр (чтобы Render() не вернул nullptr)
  // Обновляет cadence_frame_counter_ для корректного tracking'а кадров
  // Сбрасывает render_count/drop_count у оставшихся кадров
  // Обнуляет last_deadline_max_ для корректного расчёта следующего дедлайна
}
```

#### `HasFrameForTime(time)` — есть ли пригодный кадр

```cpp
bool VideoRendererAlgorithm::HasFrameForTime(base::TimeDelta time) const {
  // true если: интервал кадра покрывает time, ИЛИ кадр начинается после time,
  // ИЛИ последний кадр с неизвестной длительностью находится до time
}
```

#### `GetFrontFrameTimestamp()` — timestamp первого кадра в очереди

Используется в `VideoRendererImpl` для отбрасывания дублирующих кадров при fast-forward.

**Мелкое исправление:** в `Render()` изменена инкрементация `render_count`:

```cpp
// Было:  ++ready_frame.render_count;
// Стало: if (!ready_frame.render_count) ready_frame.render_count = 1;
```

Это предотвращает завышение счётчика при повторных вызовах `Render()` в режиме stopped time (характерно для seek).

---

### 8. `media/renderers/audio_renderer_impl.cc/.h` — `FastForwardTo()`

```cpp
void AudioRendererImpl::FastForwardTo(base::TimeDelta time,
                                      base::OnceClosure callback) {
  audio_decoder_stream_->FastForwardTo(time);  // отбросить стале декодированные буферы

  {
    base::AutoLock auto_lock(lock_);
    start_timestamp_ = time;
    // Пересоздать AudioClock с новой точкой отсчёта
    audio_clock_ = std::make_unique<AudioClock>(time, audio_parameters_.sample_rate());
    algorithm_->FlushBuffers();           // очистить алгоритм рендеринга аудио
    SetBufferingState_Locked(BUFFERING_HAVE_NOTHING);
    AttemptRead_Locked();                 // запросить новые данные
  }

  std::move(callback).Run();  // аудио завершает немедленно (sink выведет тишину до прихода новых данных)
}
```

Ключевое: `AudioClock` пересоздаётся с новым origin — это гарантирует корректную синхронизацию аудио/видео после fast-forward.

---

### 9. `media/renderers/renderer_impl.cc/.h` — координация через `BarrierClosure`

`RendererImpl` (объединяет `AudioRenderer` и `VideoRenderer`) использует `BarrierClosure` для ожидания обоих:

```cpp
void RendererImpl::FastForwardTo(base::TimeDelta media_time,
                                 PipelineStatusCallback seek_done_cb) {
  time_source_->StopTicking();
  time_source_->SetMediaTime(media_time);

  int count = (audio_renderer_ ? 1 : 0) + (video_renderer_ ? 1 : 0);
  base::RepeatingClosure barrier = base::BarrierClosure(
      count,
      base::BindOnce(&RendererImpl::CompleteFastForwardTo, ...));

  if (audio_renderer_) audio_renderer_->FastForwardTo(media_time, barrier);
  if (video_renderer_) video_renderer_->FastForwardTo(media_time, barrier);
}
```

`CompleteFastForwardTo()` возобновляет тикание таймера и уведомляет `WebMediaPlayerImpl` о завершении seek. Также переобъявляет `BUFFERING_HAVE_ENOUGH` если рендерер уже имеет достаточно данных — это важно, так как `DoSeek()` снижал ready state.

`SupportsFastForward()` возвращает `true` только если `state_ == STATE_PLAYING`.

---

### 10. `media/renderers/video_renderer_impl.cc/.h` — `FastForwardTo()` видео

Наиболее сложный из рендереров:

```cpp
void VideoRendererImpl::FastForwardTo(base::TimeDelta time,
                                      base::OnceClosure callback) {
  base::AutoLock auto_lock(lock_);
  fast_forward_cb_ = std::move(callback);
  start_timestamp_ = time;
  painted_first_frame_ = false;

  // Отбросить устаревшие кадры из VideoRendererAlgorithm
  algorithm_->DiscardFramesBefore(start_timestamp_);
  const bool has_usable_frame = algorithm_->HasFrameForTime(start_timestamp_);

  if (has_usable_frame) {
    video_decoder_stream_->FastForwardTo(start_timestamp_);
    // Callback можно выдать сразу — нужный кадр уже есть
    ready_cb = TakeFastForwardCallbackIfReady_Locked();
  } else {
    // Нет подходящего кадра → ждём новых от декодера
    video_decoder_stream_->FastForwardTo(start_timestamp_);
    TransitionToHaveNothing_Locked();
    AttemptRead_Locked();
  }
}
```

`TakeFastForwardCallbackIfReady_Locked()` проверяет, есть ли уже кадр для `start_timestamp_` (или получен `end-of-stream`), и только тогда «отдаёт» callback.

Добавлен `fast_forward_cb_` в `Flush()` — сбрасывается при стандартном seek, чтобы не было висячих callback.

`PaintFirstFrame_Locked()` получил параметр `force_repaint = false` — при fast-forward передаётся `true`, чтобы новый кадр отобразился немедленно без ожидания следующего tick compositor'а.

---

## Полная схема fast-forward пути

```
video.currentTime = T  (T > current && T в буфере)
    ↓
HTMLMediaElement → WebMediaPlayerImpl::DoSeek()
    ↓
PipelineImpl::Seek(T)
    ↓
RendererWrapper::Seek(T)
    │
    ├─ [Проверка условий]
    │   ├─ T >= renderer->GetMediaTime()  ✓
    │   ├─ FFmpegDemuxer::ShouldFastForward(T)  ✓ (в buffered range)
    │   └─ RendererImpl::SupportsFastForward(T)  ✓ (STATE_PLAYING)
    │
    └─ RendererImpl::FastForwardTo(T)
        │
        ├─ time_source_->SetMediaTime(T)
        ├─ BarrierClosure(2 callbacks)
        │
        ├─ AudioRendererImpl::FastForwardTo(T)
        │   ├─ DecoderStream::FastForwardTo(T)  [drop stale audio buffers]
        │   ├─ AudioClock reset to T
        │   ├─ algorithm_->FlushBuffers()
        │   └─ callback.Run()  ← немедленно
        │
        └─ VideoRendererImpl::FastForwardTo(T)
            ├─ algorithm_->DiscardFramesBefore(T)
            ├─ DecoderStream::FastForwardTo(T)  [drop stale video frames]
            ├─ [if has_usable_frame] PaintFirstFrame_Locked(force_repaint=true)
            └─ callback.Run()  ← когда кадр для T готов
                │
                └─ RendererImpl::CompleteFastForwardTo()
                    ├─ time_source_->StartTicking()
                    ├─ seek_done_cb.Run(PIPELINE_OK)
                    └─ client_->OnBufferingStateChange(BUFFERING_HAVE_ENOUGH)
                        │
                        └─ RendererWrapper::CompleteFastForwardSeek()
                            └─ PipelineImpl::OnSeekDone()
                                └─ WebMediaPlayerImpl — seek завершён ✓
```

---

## Что НЕ происходит при fast-forward (в отличие от стандартного seek)

| Операция                         | Стандартный seek | Fast-forward seek |
|----------------------------------|-----------------|-------------------|
| `demuxer_->AbortPendingReads()`  | ✓               | ✗                 |
| `renderer_->Flush()`             | ✓               | ✗                 |
| `demuxer_->Seek()` / `av_seek_frame` | ✓           | ✗                 |
| `FFmpegDemuxerStream::FlushBuffers()` | ✓          | ✗                 |
| Сброс декодера (Reset)           | ✓               | ✗                 |
| Повторная инициализация с keyframe | ✓             | ✗                 |
| `renderer_->StartPlayingFrom()`  | ✓               | ✗                 |

Декодер сохраняет **все reference frames** → P/B-кадры продолжают декодироваться корректно.

---

## Условия деградации (fallback на стандартный seek)

Fast-forward **не применяется** если:

1. **Seek назад** (`time < renderer->GetMediaTime()`) — без `av_seek_frame` нельзя
2. **Данные не буферизованы** — `FFmpegDemuxer::ShouldFastForward()` вернёт `false`
3. **Цель дальше 2 секунд** от read-head и не в buffered ranges — читать вперёд дольше, чем seek
4. **Рендерер не в STATE_PLAYING** — `RendererImpl::SupportsFastForward()` вернёт `false`
5. **ChunkDemuxer (MSE)** — не переопределяет `ShouldFastForward()`, возвращает `false`

---

## Ожидаемый эффект на производительность

| Метрика                            | До патча       | После патча (fast-forward) |
|------------------------------------|---------------|---------------------------|
| Время одного seek (1 I-frame видео) | ~31.5 мс      | ~2–5 мс                   |
| Пропуск `av_seek_frame`            | Нет           | Да                         |
| Пропуск `Flush` декодера           | Нет           | Да                         |
| Сложность покадрового рендеринга   | O(n²)         | O(n) при last=forward seek |
| Сравнение с Safari                 | ~10× медленнее | Сопоставимо               |

---

## Связанные файлы в Chromium

| Файл | Что изменено |
|------|-------------|
| `media/base/pipeline_impl.cc` | Логика выбора fast-forward vs. standard seek |
| `media/base/demuxer.h/.cc` | Новый виртуальный метод `ShouldFastForward()` |
| `media/base/renderer.h/.cc` | Новые методы `SupportsFastForward()`, `FastForwardTo()` |
| `media/base/audio_renderer.h` | Интерфейс `FastForwardTo()` |
| `media/base/video_renderer.h` | Интерфейс `FastForwardTo()` |
| `media/filters/ffmpeg_demuxer.cc/.h` | Реализация `ShouldFastForward()`, `GetLastPacketTimestamp()` |
| `media/filters/decoder_stream.cc/.h` | `FastForwardTo()` — сброс очередей без Reset декодера |
| `media/filters/video_renderer_algorithm.cc/.h` | `DiscardFramesBefore()`, `HasFrameForTime()`, `GetFrontFrameTimestamp()` |
| `media/renderers/audio_renderer_impl.cc/.h` | Реализация `FastForwardTo()` для аудио |
| `media/renderers/renderer_impl.cc/.h` | Реализация `FastForwardTo()` через `BarrierClosure` |
| `media/renderers/video_renderer_impl.cc/.h` | Реализация `FastForwardTo()` для видео |
