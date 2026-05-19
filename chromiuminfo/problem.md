# Problem Summary

Original context:

- Article: [HTML Video Element Seeking Performance](https://stepancar.github.io/articles/articles/html-video-element-seeking/)
- Chromium issue: [#418456081](https://issues.chromium.org/issues/418456081)
- Chromium media overview: [media/README.md](https://chromium.googlesource.com/chromium/src/+/HEAD/media/README.md)

## What Is Slow

Frame-by-frame tools often advance a paused `HTMLVideoElement` by repeatedly setting `currentTime` to the next frame timestamp. In Chromium this goes through the normal seek path:

```text
PipelineImpl::Seek()
  -> RendererWrapper::Seek()
  -> Renderer::Flush()
  -> Demuxer::Seek()
  -> FFmpeg av_seek_frame()
  -> decode forward from a keyframe
```

That behavior is safe for random access, but it repeats a lot of work for adjacent forward seeks.

## Why It Matters

The cost depends on video structure. With sparse I-frames, every target frame may require decoding from an earlier keyframe. Repeating that for a sequence of adjacent frames can make frame stepping much slower than sequential decoding.

## Optimization Scope

The patch only targets a narrow case:

```text
target_time >= current_media_time
AND demuxer can reach the target without av_seek_frame()
AND renderer has enough buffered data
```

Backward seeks, random jumps, insufficient buffered data, and demuxers that do not opt in still use the existing Chromium seek path.
