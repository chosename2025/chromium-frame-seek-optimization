# Fast-Forward Seek Implementation

The current patch is [`../patches/4.patch`](../patches/4.patch). It implements a guarded fast-forward path for repeated forward seeks in Chromium media playback and includes unit-test coverage for the new behavior.

## Standard Path

The existing seek path is:

```text
Seek(time)
  -> AbortPendingReads
  -> Renderer::Flush
  -> Demuxer::Seek / av_seek_frame
  -> refill queues from a keyframe
  -> restart playback from the target
```

This is still the fallback path and remains the behavior for cases that are not proven safe for fast-forward.

## Fast-Forward Path

The patch adds a pre-check in `PipelineImpl::RendererWrapper::Seek()`:

```cpp
if (seek_timestamp >= renderer->GetMediaTime() &&
    demuxer_->ShouldFastForward(seek_timestamp) &&
    renderer->SupportsFastForward(seek_timestamp)) {
  renderer->FastForwardTo(
      seek_timestamp,
      base::BindOnce(&RendererWrapper::CompleteFastForwardSeek, ...));
  return;
}
```

The optimization is selected only when:

1. The target timestamp is not behind the current renderer media time.
2. The demuxer can reach the target without a new FFmpeg seek.
3. The renderer is in a state where discarding stale decoded output is safe.

## Changed Components

| Component | Role |
| --- | --- |
| `media/base/pipeline_impl.cc` | Chooses fast-forward vs. standard seek before flushing. |
| `media/base/demuxer.h/.cc` | Adds `ShouldFastForward()`, defaulting to `false`. |
| `media/filters/ffmpeg_demuxer.cc/.h` | Implements reachability checks using packet queues and read-head timestamps. |
| `media/base/decoder_buffer_queue.h/.cc` | Adds `ContainsTimestamp()` for queued packet timestamp checks. |
| `media/base/renderer.h/.cc` | Adds `SupportsFastForward()` and `FastForwardTo()` virtual APIs. |
| `media/base/audio_renderer.h` | Adds `FastForwardTo()` to the audio renderer interface. |
| `media/base/video_renderer.h` | Adds `FastForwardTo()` to the video renderer interface. |
| `media/filters/decoder_stream.cc/.h` | Discards stale decoded output without resetting the decoder. |
| `media/filters/video_renderer_algorithm.cc/.h` | Discards old video frames and detects whether a frame covers a target time. |
| `media/renderers/audio_renderer_impl.cc/.h` | Repositions audio renderer state for fast-forward. |
| `media/renderers/video_renderer_impl.cc/.h` | Repositions video renderer state and forces a suitable frame update when needed. |
| `media/renderers/renderer_impl.cc/.h` | Coordinates audio/video fast-forward with a barrier callback. |
| `media/base/mock_filters.h` | Updates test mocks for the new APIs. |
| `media/base/pipeline_impl_unittest.cc` | Tests fast-forward path selection. |
| `media/renderers/renderer_impl_unittest.cc` | Tests renderer support and fallback conditions. |

## Demuxer Reachability

`FFmpegDemuxer::ShouldFastForward()` selects a reference stream, preferring video when present, and returns true when either:

- the target timestamp is still inside the current packet queue;
- the target is close to the last read packet timestamp.

The current heuristic allows:

- up to 5 seconds behind the read-head;
- up to 2 seconds ahead of the read-head.

If the read-head timestamp is unknown, fast-forward is disabled.

## Renderer Support

`RendererImpl::SupportsFastForward()` requires:

- `STATE_PLAYING`;
- no renderer waiting for data;
- active playback, or a paused video scenario where renderer state is still initialized and has enough data.

The paused video case matters because frame-by-frame tooling usually keeps `HTMLVideoElement` paused while repeatedly updating `currentTime`.

## Decoder And Frame Handling

`DecoderStream<T>::FastForwardTo()` removes decoded outputs older than the target threshold without calling `Reset()`. That preserves decoder reference frames, which is required for predictive video codecs.

`VideoRendererAlgorithm::DiscardFramesBefore()` removes stale frames while keeping at least one usable frame for rendering. It also resets render/drop counters on remaining frames so previous cadence decisions do not leak into the new position.

## Test Coverage

The patch adds:

- `PipelineImplTest.FastForwardSeek`
- `RendererImplTest.SupportsFastForwardAudioVideoPausedBothHaveEnough`
- `RendererImplTest.SupportsFastForwardReturnsFalseWhenWaiting`

See [`patch-4-validation.md`](./patch-4-validation.md) for validation commands.
