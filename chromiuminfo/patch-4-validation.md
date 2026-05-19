# Patch 4 Validation

[`../patches/4.patch`](../patches/4.patch) is the current review patch. Compared with earlier local iterations, it narrows the demuxer heuristic, adds renderer safety checks, updates mocks, and includes unit tests.

## Main Changes In Patch 4

### Packet Queue Based Reachability

Earlier iterations considered buffered ranges. Patch 4 uses the actual demuxer packet queue and the current read-head:

- `DecoderBufferQueue::ContainsTimestamp()`
- `FFmpegDemuxerStream::HasQueuedPacketFor()`
- `FFmpegDemuxerStream::GetLastPacketTimestamp()`
- `FFmpegDemuxer::ShouldFastForward()`

This is more conservative because buffered ranges can describe data that was once downloaded but is no longer available in the demuxer queue.

### Safer Renderer Gating

`RendererImpl::SupportsFastForward()` returns true only when the renderer is playing, is not waiting for enough data, and can safely service the target scenario. This includes paused video frame stepping, where `playback_rate == 0` but the renderer remains in `STATE_PLAYING` with enough audio/video data.

### Test Integration

The patch updates mocks for the new APIs:

- `MockDemuxer::ShouldFastForward()`
- `MockRenderer::SupportsFastForward()`
- `MockRenderer::FastForwardTo()`
- `MockAudioRenderer::FastForwardTo()`
- `MockVideoRenderer::FastForwardTo()`

## New Tests

`PipelineImplTest.FastForwardSeek`

Verifies that a forward seek with positive demuxer and renderer checks calls `Renderer::FastForwardTo()` and completes successfully without taking the standard flush/demuxer seek path.

`RendererImplTest.SupportsFastForwardAudioVideoPausedBothHaveEnough`

Verifies the key frame-stepping case: audio and video renderers are initialized, playback was started, `playback_rate == 0`, both streams have enough data, and fast-forward is allowed.

`RendererImplTest.SupportsFastForwardReturnsFalseWhenWaiting`

Verifies fallback when a renderer reports `BUFFERING_HAVE_NOTHING`.

## Validation Commands

Full media unit-test run:

```bash
autoninja -C out/Default media_unittests
./out/Default/media_unittests
```

Focused run:

```bash
./out/Default/media_unittests --gtest_filter="PipelineImplTest.FastForwardSeek:RendererImplTest.SupportsFastForwardAudioVideoPausedBothHaveEnough:RendererImplTest.SupportsFastForwardReturnsFalseWhenWaiting"
```

Suggested Chromium CL footer:

```text
Test: autoninja -C out/Default media_unittests
Test: ./out/Default/media_unittests
```
