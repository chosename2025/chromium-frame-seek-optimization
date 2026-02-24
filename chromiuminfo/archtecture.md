# Архитектура медиа-компонентов Chromium

> Источник: [Chromium Media README](https://chromium.googlesource.com/chromium/src/+/HEAD/media/README.md)

## Обзор

<img src="https://i.ibb.co/KxMrpd48/image.png">

Директория `//media` содержит компоненты, связанные с захватом и воспроизведением медиа-контента. Как компонент верхнего уровня, она может использоваться почти всеми другими компонентами Chromium, кроме `base/`. Некоторые компоненты могут не работать должным образом в изолированных процессах (sandboxed processes).

## Ключевые директории для видео-воспроизведения

### `blink/`
Код для взаимодействия с движком рендеринга Blink для `MediaStreams`, а также для воспроизведения `<video>` и `<audio>`. Используется только в том же процессе, что и Blink (обычно render process).

### `filters/`
Содержит источники данных, декодеры, демультиплексоры, парсеры и алгоритмы рендеринга, используемые для воспроизведения медиа.

### `ffmpeg/`
Содержит код привязки и вспомогательные методы, необходимые для использования библиотеки ffmpeg из `//third_party/ffmpeg`.

### `gpu/`
Содержит реализации аппаратных энкодеров и декодеров для платформы.

### `renderers/`
Код для рендеринга аудио и видео в выходной приемник (output sink).

### `video/`
Абстрактные интерфейсы аппаратных видео-декодеров и инструменты.

### `base/`
Содержит различные перечисления, утилитные классы и примитивы, используемые во всем `media/` и за его пределами; например, `AudioBus`, `AudioCodec`, и `VideoFrame`. Может использоваться в любом процессе.

## Pipeline воспроизведения видео

### Общий поток данных

При воспроизведении видео через тег `<video>` поток данных проходит через следующие компоненты:

```
<video> (blink::HTMLMediaElement)
    ↓
blink/public/platform/media/ (media::WebMediaPlayerImpl)
    ↓
media::PipelineController
    ↓
[media::DataSource, media::Demuxer, media::Renderer]
```

### Детальное описание компонентов

#### 1. **HTMLMediaElement → WebMediaPlayerImpl**

- При воспроизведении видео тег `<video>` (HTMLMediaElement) взаимодействует с `media::WebMediaPlayerImpl` (Blink) — именно он отвечает за загрузку и воспроизведение медиа.
- `<video>` (и `<audio>`) начинается в `blink::HTMLMediaElement` в `third_party/blink/`
- Через `content::MediaFactory` достигает `media::WebMediaPlayerImpl` в `third_party/blink/public/platform/media/`
- Каждый `HTMLMediaElement` владеет своим `WebMediaPlayerImpl`, который координирует объекты `PipelineController`, `DataSource`, `Demuxer` и `Renderer`.
- Операции: play, pause, **seek**, изменение громкости и т.д.

#### 2. **WebMediaPlayerImpl**

- Обрабатывает или делегирует загрузку медиа по сети
- Управляет инициализацией демультиплексора (demuxer) и пайплайна
- Владеет `media::PipelineController`, который координирует работу `media::DataSource`, `media::Demuxer` и `media::Renderer` во время воспроизведения

#### 3. **Demuxer (Демультиплексор)**

Во время нормального воспроизведения `media::Demuxer`, принадлежащий `WebMediaPlayerImpl`, может быть:

- **`media::FFmpegDemuxer`** — для обычного воспроизведения по `src=` в качестве демультиплексора используется именно он; `WebMediaPlayerImpl` отвечает за загрузку байтов по сети
- **`media::ChunkDemuxer`** — используется с Media Source Extensions (MSE), где JavaScript-код предоставляет мультиплексированные байты

Визуально медиа-пайплайн состоит из последовательности фильтров: сначала **Demuxer** (FFmpegDemuxer), затем декодеры и, наконец, рендереры аудио и видео. Схема: *Media pipeline Chromium (демультиплексирование → декодирование → рендеринг)*.

> **Важно для seeking:** Demuxer отвечает за парсинг видео-файла и извлечение кадров. Производительность seeking напрямую зависит от того, как demuxer находит и извлекает нужные кадры.

#### 4. **Renderer**

- Обычно это `media::RendererImpl`, который владеет и координирует экземпляры `media::AudioRenderer` и `media::VideoRenderer`
- Каждый из них в свою очередь владеет набором реализаций `media::AudioDecoder` и `media::VideoDecoder`

#### 5. **DecoderStream и декодирование**

- Каждый декодер выполняет асинхронное чтение из `media::DemuxerStream`, предоставляемого `media::Demuxer`
- Чтение маршрутизируется к правильному декодеру через `media::DecoderStream`
- Декодирование асинхронное, поэтому декодированные кадры доставляются позже в соответствующий рендерер

#### 6. **Декодеры**

Библиотека `media/` содержит:

- **Аппаратные декодеры** в `media/gpu` для всех поддерживаемых платформ Chromium
- **Программные декодеры** в `media/filters`, основанные на FFmpeg и libvpx

Декодеры пробуются в порядке, предоставленном через `media::RendererFactory`; первый, который сообщает об успехе, будет использован для воспроизведения (обычно аппаратный декодер для видео).

#### 7. **VideoRenderer и синхронизация**

- `media::VideoRenderer` управляет таймингом и рендерингом видео через событийно-управляемый интерфейс `media::VideoRendererSink`
- `media::VideoRendererSink` принимает callback, который вызывается периодически, когда требуются новые видео-кадры
- На стороне видео `media::VideoRendererSink` управляется асинхронными callback'ами, выдаваемыми композитором в `media::VideoFrameCompositor`
- `media::VideoRenderer` взаимодействует с `media::AudioRenderer` через `media::TimeSource` для координации синхронизации аудио и видео

---

## Инициализация и запуск воспроизведения

Когда вы устанавливаете `video.src` и вызываете `play()`, `WebMediaPlayerImpl` начинает загрузку через **DataSource** (например, `BufferedDataSource` или `MultibufferDataSource` для сети).

1. После инициализации источника данных запускается **`FFmpegDemuxer::Initialize`**, который создаёт внутри себя **FFmpegGlue** и **BlockingUrlProtocol** для низкоуровневого чтения потока.
2. На фоновом потоке выполняется **`avformat_open_input`** (через `FFmpegGlue::OpenContext`), а после его завершения вызывается **`OnOpenContextDone`**.
3. В **`OnOpenContextDone`** выполняется **`avformat_find_stream_info`** (поиск информации о потоках), а по завершении — **`OnFindStreamInfoDone`**.
4. В **`OnFindStreamInfoDone`** `FFmpegDemuxer` анализирует найденные потоки контейнера:
   - отбрасывает неподдерживаемые;
   - создаёт объекты **`FFmpegDemuxerStream`** для аудио/видео;
   - определяет кодеки и конфигурации декодеров;
   - устанавливается начальное время **`start_time_`** (минимальный из потоков) и продолжительность **`duration_`** (максимальное из потоков или из контейнера).
5. Затем `FFmpegDemuxer` сообщает PipelineHost о готовности: устанавливает длительность и вызывает callback об успешной инициализации.

Таким образом, до начала реального рендеринга происходит полный анализ контейнера и подготовка демультиплексора (чтение заголовков, настроек кодеков и т.д.).

---

## Процесс воспроизведения (Playback)

После успешной инициализации `WebMediaPlayerImpl` запускает медиа-пайплайн: вызывается **`PipelineImpl::Start()`**, который в медиа-потоке создаёт **RendererWrapper** (обёртку над аудио- и видеорендерерами) и передаёт ему демультиплексор.

Далее начинается цикл чтения и декодирования:

- **FFmpegDemuxer** в фоновом потоке непрерывно читает пакет за пакетом из `BlockingUrlProtocol` (фактически через **`av_read_frame`**) до конца файла или до исчерпания ресурсов.
- Демультиплексор реализует метод **`ReadFrameIfNeeded`**, который асинхронно вызывает **`ReadFrameAndDiscardEmpty`** и по окончании передачи пакетов вызывает **`OnReadFrameDone`**.
- В **`OnReadFrameDone`** полученный `AVPacket` направляется в соответствующий поток (по индексу `packet->stream_index`). Если у пакета есть данные и он попадает в существующий `FFmpegDemuxerStream`, вызывается **`FFmpegDemuxerStream::EnqueuePacket`**, который ставит пакет в очередь декодера.
- **`ReadFrameIfNeeded`** продолжает чтение следующих пакетов, пока ёмкости очередей декодеров позволяют (проверяется **`HasAvailableCapacity()`** для каждого потока). Аудио- и видеоданные последовательно заполняют буферы декодеров.
- Асинхронно запускается декодирование: каждый **AudioDecoder** / **VideoDecoder** читает данные из своего **DemuxerStream** и выдаёт аудио/видео фреймы.
- В аудио-канале фреймы отправляются в **AudioRendererSink** (напрямую в ОС), в видео — в **VideoRendererSink** (например, **VideoFrameCompositor** для вывода через GPU). Оба рендерера синхронизируются по общему тайм-коду (**TimeSource**, общая аудио-синхронизация).

---

## Операция перемотки (Seek)

При установке `video.currentTime = t` или вызове `seek()` **`WebMediaPlayerImpl`** выполняет метод **`DoSeek`**, который фиксирует новое время и уведомляет **PipelineController** о необходимости поиска. В итоге вызывается **`PipelineImpl::Seek(time)`**.

### Последовательность при Seek

1. **`PipelineImpl::Seek(time)`** ставит **RendererWrapper** в состояние «seeking» и в медиа-потоке выполняет **`RendererWrapper::Seek(time)`**.
2. **Прекращение текущего чтения:** вызывается **`demuxer_->AbortPendingReads()`** и посылается **`Renderer::Flush()`**, чтобы сбросить все устаревшие кадры в рендерере.
3. **Поиск:** вызывается **`FFmpegDemuxer::Seek(time)`**. Метод асинхронно корректирует время (с учётом возможного начального смещения `start_time_` и преролла Opus) и вызывает **`av_seek_frame`** на низкоуровневом потоке (через FFmpegGlue). FFmpeg ищет ближайший ключевой кадр, обычно назад относительно нужного времени (флаг **`AVSEEK_FLAG_BACKWARD`**), а если не сработало — без флага, чтобы найти любой ключевой кадр.
4. Когда **`av_seek_frame`** завершает работу, демультиплексор переходит в **`OnSeekFrameDone`**. При успехе всем **FFmpegDemuxerStream** выполняется **`FlushBuffers(false)`**, чтобы очистить очереди и позволить обработать новые данные.
5. Демультиплексор продолжает чтение с новой позиции: снова вызывается **`ReadFrameIfNeeded()`**, начинается декодирование с найденного ключевого кадра.
6. По окончании поиска вызывается callback успеха **PipelineStatusCallback (PIPELINE_OK)**, и `WebMediaPlayerImpl` получает событие завершения seek.

### Отличие Playback и Seek

- **При перемотке:** прерывание потока данных, сброс буферов, произвольный переход к новому времени через **`av_seek_frame`**. Seek более ресурсоёмок: **AbortPendingReads**, **Flush** декодеров, позиционирование демультиплексора, затем заполнение буферов с новой точки.
- **В обычном режиме:** демультиплексор просто читает кадры последовательно без перезапуска.

После Seek **FFmpegDemuxer** гарантирует, что поток начнётся с ближайшего ключевого кадра и все последующие пакеты будут переданы декодерам.

**Управление состоянием пайплайна:**

- В режиме **Playback** `PipelineImpl` находится в состоянии **kPlaying**, демультиплексор постоянно читается по мере надобности.
- При **Seek** `PipelineImpl` переходит в состояние **kSeeking**, блокируя дальнейшее чтение до завершения поиска, очищает буферы и затем возвращается в **kPlaying** после reposition.

Воспроизведение и seek используют одни и те же компоненты (WebMediaPlayerImpl, Pipeline, FFmpegDemuxer, декодеры, рендереры), но отличаются потоком управления: при **play** данные читаются непрерывно, при **seek** — пауза, reposition FFmpegDemuxer и повторный запуск чтения из новой позиции.

---

## Ссылки на код Chromium

Детали описанного поведения можно увидеть в исходниках Chromium:

| Компонент | Файл / описание |
|-----------|------------------|
| Инициализация демультиплексора | **FFmpegDemuxer::Initialize** — [media/filters/ffmpeg_demuxer.cc](https://chromium.googlesource.com/chromium/src/media/+/master/filters/ffmpeg_demuxer.cc) |
| Заголовок FFmpegDemuxer | [media/filters/ffmpeg_demuxer.h](https://chromium.googlesource.com/chromium/src/+/HEAD/media/filters/ffmpeg_demuxer.h) |
| Чтение пакетов | **FFmpegDemuxer::OnReadFrameDone** — [filters/ffmpeg_demuxer.cc](https://chromium.googlesource.com/chromium/src/media/+/master/filters/ffmpeg_demuxer.cc) |
| Поиск (seek) | **FFmpegDemuxer::Seek** и **OnSeekFrameDone** — [filters/ffmpeg_demuxer.cc](https://chromium.googlesource.com/chromium/src/media/+/master/filters/ffmpeg_demuxer.cc) |
| WebMediaPlayerImpl | [media/blink/webmediaplayer_impl.cc](https://chromium.googlesource.com/chromium/src/+/9bfe4e2f473b01d5039dd31c9b04cc8c78ff5c70/media/blink/webmediaplayer_impl.cc) |
| Pipeline (запуск, seek) | [media/base/pipeline_impl.cc](https://chromium.googlesource.com/chromium/src/+/refs/tags/144.0.7553.0/media/base/pipeline_impl.cc) |
| Обзор media/ | [media/README.md](https://chromium.googlesource.com/chromium/src/+/HEAD/media/README.md) |

Эти фрагменты показывают, как именно демультиплексор и медиа-пайплайн обрабатывают инициализацию, воспроизведение и seek.

**Архитектурное ограничение:** Почему нельзя «просто проверить следующий кадр», где происходит фатальный сброс при seek и почему оптимизация fast-forward должна быть в PipelineController/RendererWrapper, а не в Demuxer — см. [seek-limitation-and-safari.md](./seek-limitation-and-safari.md). Там же сравнение с Safari (WebKit/AVFoundation).

---

## Отладка и логирование

### chrome://media-internals

При отладке проблем полезно просматривать внутренние логи на `chrome://media-internals`. Страница internals содержит информацию о:

- Активных экземплярах `media::WebMediaPlayerImpl`
- `media::AudioInputController`
- `media::AudioOutputController`
- `media::AudioOutputStream`

### DVLOG

В медиа-компонентах широко используется `DVLOG()` для логирования. Рекомендации по уровням:

- **DVLOG(1):** События один раз за воспроизведение или другие важные события (конструкция/деструкция, инициализация, начало/конец воспроизведения, suspend/resume, любые условия ошибок)
- **DVLOG(2):** Повторяющиеся события за воспроизведение (seek/reset/flush, изменение конфигурации)
- **DVLOG(3):** Частые события (чтение demuxer, расшифровка/декодирование аудио/видео буферов, рендеринг аудио/видео кадров)

### MediaLog

`MediaLog` отправляет логи в `about://media-internals`, который легко доступен разработчикам, тестировщикам и даже пользователям для получения подробной информации об экземпляре воспроизведения.

## Релевантность для оптимизации seeking

Для оптимизации покадровой перемотки (`frame-by-frame seeking`) критически важны следующие компоненты:

1. **`media::WebMediaPlayerImpl`** — обрабатывает запросы на seeking от `HTMLMediaElement`
2. **`media::FFmpegDemuxer`** — отвечает за поиск нужных кадров в видео-файле
3. **`media::VideoDecoder`** — декодирует найденные кадры
4. **`media::VideoRenderer`** — управляет рендерингом кадров
5. **`media::VideoFrameCompositor`** — координирует отображение кадров

Производительность seeking зависит от эффективности поиска I-фреймов и декодирования промежуточных кадров до целевого момента времени.

---

## Источники

- [Chromium Media README](https://chromium.googlesource.com/chromium/src/+/HEAD/media/README.md) — обзор директории `media/`
- [webmediaplayer_impl.cc](https://chromium.googlesource.com/chromium/src/+/9bfe4e2f473b01d5039dd31c9b04cc8c78ff5c70/media/blink/webmediaplayer_impl.cc) — WebMediaPlayerImpl (Blink)
- [ffmpeg_demuxer.cc](https://chromium.googlesource.com/chromium/src/media/+/master/filters/ffmpeg_demuxer.cc) — FFmpegDemuxer (инициализация, чтение пакетов, seek)
- [ffmpeg_demuxer.h](https://chromium.googlesource.com/chromium/src/+/HEAD/media/filters/ffmpeg_demuxer.h) — заголовок FFmpegDemuxer
- [pipeline_impl.cc](https://chromium.googlesource.com/chromium/src/+/refs/tags/144.0.7553.0/media/base/pipeline_impl.cc) — PipelineImpl (Start, Seek, RendererWrapper)