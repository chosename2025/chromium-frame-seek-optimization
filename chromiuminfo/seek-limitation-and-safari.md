# Архитектурное ограничение seek и сравнение с Safari

> **Контекст:** См. [archtecture.md](./archtecture.md) (медиа-пайплайн Chromium), [issue.md](./issue.md) (проблема покадровой перемотки).

Этот документ разбирает **фундаментальное архитектурное ограничение** текущего media pipeline Chromium + FFmpeg: почему нельзя «просто проверить следующий кадр», где именно происходит «фатальный» сброс при seek, и **как это решено в WebKit (Safari)** — для аргументации в дипломе и выбора места оптимизации.

---

## Часть I. Ограничение Chromium: Playback ≠ Seek ≠ Fast-forward

### 1. Ключевая идея: только два режима работы с позицией

В Chromium сейчас есть **только два режима работы с позицией**:

1. **Sequential playback** → читаем `av_read_frame()` подряд  
2. **Random access (Seek)** → `av_seek_frame()` → *обязательно* к ключевому кадру  

**Промежуточного режима «продвинуться вперёд без сброса» в архитектуре не существует.**

---

### 2. Где именно происходит «фатальный» сброс при seek

**Точка входа:**

```text
PipelineImpl::Seek(base::TimeDelta time)
    ↓
RendererWrapper::Seek(time)
    ↓
demuxer_->Seek(time, callback)
```

В **`FFmpegDemuxer::Seek`** ключевые действия:

1. `AbortPendingReads()`
2. `av_seek_frame(...)`
3. `FlushBuffers(false)`
4. Возврат в normal read loop

**Сброс буферов происходит всегда**, независимо от того, насколько маленький шаг seek.

---

### 3. Почему Chromium всегда возвращается к keyframe

**Причина 1: требования декодеров**

Большинство видео-кодеков (H.264 / H.265 / VP9):

- **не могут декодировать P/B-кадры без reference frames**
- reference frames **начинаются с keyframe (IDR)**

Даже если нужен «следующий кадр», он может быть зависим от предыдущих.

**Причина 2: FFmpeg API**

FFmpeg **не предоставляет API** вида «дай следующий кадр начиная с произвольного timestamp без seek». Есть только:

- `av_read_frame()` → строго sequential  
- `av_seek_frame()` → прыжок к keyframe  

---

### 4. Почему Chromium не может «проверить, что следующий кадр доступен»

Желаемое поведение:

> если `next_frame.timestamp ≈ current + ε` → просто дочитать  

**Проблема:** `FFmpegDemuxer` **не знает**, что будет следующим:

- `av_read_frame()` читает из IO  
- Нет предпросмотра кадров  
- Нет индекса frame-by-frame  
- Нет гарантии, что следующий кадр — decodable  

Контейнер может быть в сети, VBR, с interleaved audio/video.

---

### 5. Где теоретически можно встроить fast-forward

**Единственная реалистичная точка — до вызова Seek:**

```cpp
PipelineImpl::Seek(time)
```

Здесь можно ввести **эвристику**:

```text
if (time > current_time &&
    time < last_buffered_frame_time &&
    decoder_can_continue)
{
    // НЕ вызывать demuxer->Seek()
    // Просто дать pipeline доиграть
}
```

---

### 6. Что именно можно проверить (реалистично)

**6.1. Проверка buffered ranges**

Цепочка: `HTMLMediaElement::buffered()` → Blink → WebMediaPlayerImpl → PipelineController.

Если `time` ∈ buffered range → **не обязательно делать seek**.  
Но Chromium всё равно делает seek — это **архитектурное решение**, не техническая необходимость.

**6.2. Проверка decoder state**

Если:

- декодер не в error  
- нет gap  
- очередь `DemuxerStream` не пуста  

→ можно не делать seek, а просто «прокрутить время».

---

### 7. Почему Chromium этого не делает сейчас

Реальные причины:

1. Сложность синхронизации аудио/видео  
2. Риск рассинхрона  
3. MSE / EME / DRM совместимость  
4. Edge cases с Opus preroll  
5. Принцип **correctness > performance**  

Chromium предпочитает: *«всегда корректно, пусть и медленнее»*.

---

### 8. Как это можно реализовать (архитектурно правильно)

**Вариант A (наиболее чистый)**

Добавить новый режим:

```cpp
enum SeekMode {
  kAccurateSeek,
  kFastForward
};
```

В `PipelineImpl::Seek`:

```cpp
if (CanFastForward(time)) {
  renderer_->SetPlaybackTime(time);
  return;
}
demuxer_->Seek(time);
```

**Вариант B (на уровне демультиплексора)**

В `FFmpegDemuxer::Seek`:

```cpp
if (time > last_read_timestamp &&
    time < buffered_end &&
    no_decoder_reset_needed)
{
    // просто discard packets < time
    return;
}
```

Очень опасно: FFmpeg не гарантирует корректность reference frames.

---

### 9. Почему fast-forward возможен только для playback вперёд

- backward seek → невозможен без keyframe  
- random seek → невозможен без keyframe  
- **forward seek внутри buffered window** → возможен  

Это именно тема **«оптимизация покадровой перемотки»** — оптимизация упирается в этот случай.

---

### 10. Ключевой вывод (Chromium)

> В Chromium **невозможно безопасно определить «следующий кадр» на уровне FFmpegDemuxer**, потому что:
>
> - FFmpeg не даёт frame index  
> - декодеры зависят от keyframes  
> - pipeline не поддерживает partial seek  

**Единственно правильное место для оптимизации — PipelineController / RendererWrapper, а не Demuxer.**

---

## Часть II. Сравнение с Safari (WebKit)

### 1. Ключевое отличие Safari от Chromium

> **Safari не использует FFmpeg и не делает seek через demuxer.  
> Он управляет временем воспроизведения через native media framework (AVFoundation).**

Это снимает большую часть ограничений, присущих Chromium.

---

### 2. Общая архитектура WebKit media pipeline

Для `<video>` в Safari:

```text
HTMLMediaElement
    ↓
MediaPlayer
    ↓
MediaPlayerPrivateAVFoundation
    ↓
AVPlayer / AVSampleBufferDisplayLayer
```

**Нет понятия Demuxer/Decoder как отдельных сущностей**, как в Chromium.

---

### 3. Где реализован seek в WebKit

Цепочка вызовов:

```text
HTMLMediaElement::setCurrentTime()
    ↓
MediaPlayer::seek()
    ↓
MediaPlayerPrivateAVFoundation::seek()
```

Файл: `Source/WebCore/platform/graphics/avfoundation/MediaPlayerPrivateAVFoundation.mm`

---

### 4. Как Safari различает seek и fast-forward

В WebKit есть **логика определения типа seek**. Упрощённо:

```cpp
bool isSmallForwardSeek =
    newTime > currentTime &&
    newTime - currentTime < smallSeekThreshold &&
    isBuffered(newTime);
```

Если это **небольшой шаг вперёд**, Safari **не делает полноценный seek**.

---

### 5. Что Safari делает вместо seek

Вместо полного `[AVPlayerItem seekToTime:...]` Safari может:

- установить `player.rate = 0`, затем `player.currentTime = newTime`, затем вернуть `rate`  
- или вообще **ничего**, если декодер уже дошёл до нужного времени  

**AVFoundation сам решает**, нужно ли сбрасывать декодеры, искать keyframe или просто дочитать.

---

### 6. Почему AVFoundation это может, а FFmpeg — нет

**AVFoundation умеет:**

1. Хранить **декодированные reference frames**  
2. Иметь **frame-accurate timeline**  
3. Выполнять **frame discard без reset**  
4. Делать **decode-ahead**  

**FFmpeg:**

- stateless demux  
- no frame graph  
- no reference lifetime tracking  

Safari делегирует сложность ОС; Chromium держит всё в приложении.

---

### 7. SampleBuffer-based pipeline

Safari работает не с «пакетами», а с **`CMSampleBuffer`**:

- уже декодированные  
- с точным timestamp  
- self-contained сущности  

AVFoundation может «пропустить всё до timestamp T» без seek.

---

### 8. Buffered ranges реально влияют на стратегию seek

В WebKit buffered ranges **влияют на решение о seek**, а не только на UI:

```cpp
if (bufferedRangesContain(time)) {
    // prefer no seek
}
```

В Chromium buffered ranges **не влияют на поведение demuxer**.

---

### 9. Почему Safari не обязан возвращаться к keyframe

- reference frames уже в decoder cache  
- AVFoundation знает dependency graph  
- граница keyframe — внутреннее дело декодера  

В Chromium demuxer не знает ничего о декодере, поэтому seek всегда начинается с keyframe.

---

### 10. Как Safari делает fast-forward по кадрам

Для небольшого шага Safari часто:

1. Оставляет pipeline в режиме playing  
2. Увеличивает `playbackRate` (например 2×)  
3. Затем возвращает rate обратно  

Это **не seek**, а controlled playback.

---

### 11. Почему это невозможно повторить в Chromium 1:1

| Safari                | Chromium            |
|-----------------------|---------------------|
| AVFoundation          | FFmpeg              |
| Decoder stateful      | Decoder reset-based |
| Frame graph known     | Frame graph unknown |
| SampleBuffer timeline | Packet-based        |
| OS-level media        | App-level media     |

---

### 12. Точка принятия решения в коде WebKit

Файл: **MediaPlayerPrivateAVFoundation.mm**

Идея:

```cpp
if (canPerformFastForward(time)) {
    m_pendingSeek = false;
    return;
}
performAccurateSeek(time);
```

(упрощённо, но логически именно так)

---

### 13. Почему Safari быстрее перематывает (в т.ч. YouTube)

Не из-за сети и не из-за кодеков. А потому что:

- **не трогает demuxer**  
- **не сбрасывает decoder**  
- **не выполняет av_seek_frame-эквивалент**  

---

### 14. Связь с темой диплома

Краткий сравнительный аргумент:

> **Chromium** — correctness-first, demuxer-driven.  
> **WebKit** — performance-first, decoder-driven.

Формулировка для диплома:

> «Safari реализует покадровую перемотку за счёт управления декодированными sample buffers, в то время как Chromium вынужден выполнять полный seek из-за отсутствия информации о зависимостях кадров на уровне демультиплексора.»

---

### 15. Главный вывод (Safari)

> **Safari решает fast-forward не через seek, а через управление временем воспроизведения и состоянием декодера.**

Поэтому Safari может делать быструю перемотку вперёд без полного seek, а Chromium архитектурно — нет (пока).

---

## Итог для оптимизации в Chromium

1. **Место изменений:** PipelineController / RendererWrapper (эвристика до вызова `demuxer_->Seek()`), а не FFmpegDemuxer.  
2. **Условия fast-forward:** небольшой шаг вперёд, время в buffered range, декодер в рабочем состоянии.  
3. **Сравнение с Safari:** полезно как глава «Сравнение браузерных движков» и обоснование выбора точки оптимизации.

---

## Ссылки

- [archtecture.md](./archtecture.md) — медиа-пайплайн Chromium, Seek, Playback  
- [issue.md](./issue.md) — проблема и предложенное решение  
- Chromium: `media/base/pipeline_impl.cc`, `media/filters/ffmpeg_demuxer.cc`  
- WebKit: `Source/WebCore/platform/graphics/avfoundation/MediaPlayerPrivateAVFoundation.mm`
