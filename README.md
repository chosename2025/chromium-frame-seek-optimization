# Оптимизация покадровой перемотки HTMLVideoElement в Chromium

## Проблема

При покадровой перемотке видео через `HTMLVideoElement` в Chromium возникает проблема производительности. Операция seeking имеет сложность O(n), где n — количество кадров до целевого момента времени. Это означает, что для получения всех кадров видео (покадровый рендеринг) сложность составляет O(n²).

**Основные факты:**

- Chromium значительно медленнее Safari при seeking (примерно в 10 раз)
- Производительность зависит от количества I-фреймов в видео: чем меньше I-фреймов, тем медленнее seeking
- Для видео с одним I-фреймом seeking в Chromium может занимать ~31.5 мс на кадр, в то время как в Safari ~2.2 мс

Эта проблема критична для приложений, требующих покадровой обработки видео (видео-редакторы, рендеринг эффектов и т.д.).

Более подробная статья о проблеме [HTMLVideoElement seeking](https://stepancar.github.io/articles/articles/html-video-element-seeking/) от [@stepancar](https://github.com/stepancar).

**Подробности:** См. [chromiuminfo/issue.md](./chromiuminfo/issue.md) для детального описания проблемы и предложенного решения.

---

## Реализованное решение: Fast-Forward Seek

Патч реализует **«быстрый» путь seek** (`fast-forward`), который исключает полный сброс декодера при последовательных seek-операциях вперёд.

**Ключевая идея:** если целевое время находится впереди текущей позиции и данные уже буферизованы, вместо стандартного `Flush → av_seek_frame → reset` выполняется только отбрасывание устаревших кадров из очереди.

### Условия активации fast-forward

```
seek_target >= current_time           (шаг вперёд)
 AND FFmpegDemuxer::ShouldFastForward()  (данные в буфере / ≤2с от read-head)
 AND RendererImpl::SupportsFastForward() (STATE_PLAYING)
```

При несоблюдении любого условия выполняется стандартный seek (обратная совместимость сохранена).

### Ожидаемые улучшения производительности

| Метрика | До патча | После патча |
|---------|---------|-------------|
| Время одного seek (1 I-frame видео) | ~31.5 мс | ~2–5 мс |
| Сложность покадрового рендеринга | O(n²) | O(n) |
| Сравнение с Safari | ~10× медленнее | Сопоставимо |

**Подробное описание реализации:** [chromiuminfo/implementation.md](./chromiuminfo/implementation.md)

---

## Архитектура решения

### Затронутые компоненты

Патч [patches/3.patch](./patches/3.patch) изменяет 11 файлов в 4 директориях:

```
media/base/
├── pipeline_impl.cc      ← точка выбора fast-forward vs. standard seek
├── demuxer.h/.cc         ← новый метод ShouldFastForward()
├── renderer.h/.cc        ← новые методы SupportsFastForward(), FastForwardTo()
├── audio_renderer.h      ← интерфейс FastForwardTo()
└── video_renderer.h      ← интерфейс FastForwardTo()

media/filters/
├── ffmpeg_demuxer.cc/.h  ← реализация ShouldFastForward(), GetLastPacketTimestamp()
├── decoder_stream.cc/.h  ← FastForwardTo() — сброс очередей без Reset декодера
└── video_renderer_algorithm.cc/.h ← DiscardFramesBefore(), HasFrameForTime()

media/renderers/
├── audio_renderer_impl.cc/.h ← реализация FastForwardTo() для аудио
├── renderer_impl.cc/.h       ← координация через BarrierClosure
└── video_renderer_impl.cc/.h ← реализация FastForwardTo() для видео
```

### Общий медиа-пайплайн (контекст)

```
<video> (blink::HTMLMediaElement)
    ↓
blink/public/platform/media/ (media::WebMediaPlayerImpl)
    ↓
media::PipelineController
    ↓
[media::DataSource, media::Demuxer, media::Renderer]
```

**Архитектурный контекст:** [chromiuminfo/archtecture.md](./chromiuminfo/archtecture.md)  
**Почему оптимизация в PipelineController, а не в Demuxer:** [chromiuminfo/seek-limitation-and-safari.md](./chromiuminfo/seek-limitation-and-safari.md)

---

## Документация

| Документ | Описание |
|----------|---------|
| [chromiuminfo/implementation.md](./chromiuminfo/implementation.md) | **Детальное описание патча:** изменённые файлы, схема fast-forward, сравнение путей |
| [chromiuminfo/issue.md](./chromiuminfo/issue.md) | Описание проблемы и её контекст (Chromium Issue #418456081) |
| [chromiuminfo/archtecture.md](./chromiuminfo/archtecture.md) | Архитектура медиа-пайплайна Chromium |
| [chromiuminfo/seek-limitation-and-safari.md](./chromiuminfo/seek-limitation-and-safari.md) | Архитектурные ограничения и сравнение с Safari |
| [chromiuminfo/build.md](./chromiuminfo/build.md) | Сборка и разработка Chromium |

---

## Работа с репозиторием Chromium

Для внесения изменений в Chromium необходимо настроить окружение разработки:

- **Системные требования:** Ubuntu 22.04 LTS, ≥16 ГБ RAM, ≥100 ГБ свободного места
- **Получение исходного кода:** Использование `depot_tools` для клонирования репозитория
- **Сборка:** Использование системы сборки GN (Generate Ninja)
- **Тестирование:** Запуск юнит-тестов и browser-тестов для проверки изменений

**Подробности:** [chromiuminfo/build.md](./chromiuminfo/build.md)

---

## Дополнительные ресурсы

- **Chromium Issue Tracker:** [Issue #418456081](https://issues.chromium.org/issues/418456081)
- **Chromium Media README:** [chromium.googlesource.com/chromium/src/+/HEAD/media/README.md](https://chromium.googlesource.com/chromium/src/+/HEAD/media/README.md)
- **Статья о проблеме:** [HTMLVideoElement seeking](https://stepancar.github.io/articles/articles/html-video-element-seeking/) от [@stepancar](https://github.com/stepancar)
