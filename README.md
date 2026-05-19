# Chromium Frame Seek Optimization

This repository contains a Chromium media-pipeline experiment for improving repeated forward seeks on `HTMLVideoElement`, plus a browser benchmark for measuring frame-by-frame seek performance.

## Context

- Original write-up: [HTML Video Element Seeking Performance](https://stepancar.github.io/articles/articles/html-video-element-seeking/)
- Chromium issue: [#418456081](https://issues.chromium.org/issues/418456081)
- Chromium media overview: [media/README.md](https://chromium.googlesource.com/chromium/src/+/HEAD/media/README.md)

The expensive case is frame-by-frame navigation: applications repeatedly assign nearby increasing `currentTime` values while the video is paused. Chromium normally handles each assignment as a full seek, which flushes renderer/decoder state and asks FFmpeg to seek back to a keyframe.

## Repository Layout

| Path | Purpose |
| --- | --- |
| [`patches/4.patch`](./patches/4.patch) | Current Chromium patch. |
| [`chromiuminfo/problem.md`](./chromiuminfo/problem.md) | Problem summary and links to the original context. |
| [`chromiuminfo/implementation.md`](./chromiuminfo/implementation.md) | Implementation notes and changed Chromium components. |
| [`chromiuminfo/patch-4-validation.md`](./chromiuminfo/patch-4-validation.md) | Unit tests and validation commands. |
| [`benchmark/`](./benchmark/) | Vue + TypeScript benchmark app. |

## Patch Summary

The patch adds a guarded fast-forward path before Chromium's standard seek path:

```cpp
if (seek_timestamp >= renderer->GetMediaTime() &&
    demuxer_->ShouldFastForward(seek_timestamp) &&
    renderer->SupportsFastForward(seek_timestamp)) {
  renderer->FastForwardTo(seek_timestamp, ...);
  return;
}
```

When the target is reachable from current demuxer/renderer state, Chromium can discard stale decoded output instead of doing a full `Flush -> av_seek_frame -> decoder reset` cycle. If any safety check fails, the existing seek behavior is used.

## Chromium Validation

```bash
autoninja -C out/Default media_unittests
./out/Default/media_unittests
```

Focused run:

```bash
./out/Default/media_unittests --gtest_filter="PipelineImplTest.FastForwardSeek:RendererImplTest.SupportsFastForwardAudioVideoPausedBothHaveEnough:RendererImplTest.SupportsFastForwardReturnsFalseWhenWaiting"
```

## Benchmark

Local run:

```bash
cd benchmark
npm install
npm run dev
```

GitHub Pages deployment is configured in [`.github/workflows/deploy-benchmark.yml`](./.github/workflows/deploy-benchmark.yml). In repository settings, set Pages source to **GitHub Actions**.
