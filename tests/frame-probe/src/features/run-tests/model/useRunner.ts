import type { TestResult, PhaseResult, FrameResult, VideoManifestItem, BrowserProfile } from '@/entities/test-result/types'

export interface RunnerState {
  isRunning: boolean
  isStopped: boolean
  currentVideo: VideoManifestItem | null
  videoIndex: number
  totalVideos: number
  phase: string
  phaseFrameIndex: number
  phaseTotalFrames: number
  phaseProgress: number
  totalProgress: number
  totalElapsed: number
}

export interface RunnerCallbacks {
  onStateUpdate: (s: Partial<RunnerState>) => void
  onResult?: (r: TestResult) => void
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise(resolve => {
    const handler = () => { video.removeEventListener('seeked', handler); resolve() }
    video.addEventListener('seeked', handler)
    const maxTime = isFinite(video.duration) ? video.duration - 0.0001 : 1e9
    video.currentTime = Math.max(0, Math.min(time, maxTime))
  })
}

function markOffByOne(frames: FrameResult[]): number {
  let count = 0
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    if (f.ok || !f.found) continue
    const dist = Math.abs(f.found.x - f.expected.x) + Math.abs(f.found.y - f.expected.y)
    if (dist !== 1) continue
    const prevOk = i === 0 || frames[i - 1].ok || frames[i - 1].offByOne
    const nextOk = i === frames.length - 1 || frames[i + 1].ok || frames[i + 1].offByOne
    if (prevOk && nextOk) { f.offByOne = true; count++ }
  }
  return count
}

function scanFrame(video: HTMLVideoElement, ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.drawImage(video, 0, 0)
  const data = ctx.getImageData(0, 0, W, H).data
  let maxB = -1, fx = -1, fy = -1
  for (let i = 0; i < W * H; i++) {
    const off = i * 4
    const b = Math.round(data[off] * 0.299 + data[off + 1] * 0.587 + data[off + 2] * 0.114)
    if (b > maxB) { maxB = b; fx = i % W; fy = Math.floor(i / W) }
  }
  return { x: fx, y: fy, brightness: maxB }
}

export async function runTests(
  videos: VideoManifestItem[],
  _browserProfile: BrowserProfile,
  cbs: RunnerCallbacks,
) {
  const results: TestResult[] = []
  const startTime = performance.now()

  for (let vi = 0; vi < videos.length; vi++) {
    const videoMeta = videos[vi]
    const videoStart = performance.now()

    cbs.onStateUpdate({
      currentVideo: videoMeta,
      videoIndex: vi,
      totalVideos: videos.length,
      phase: 'loading',
      phaseFrameIndex: 0,
      phaseTotalFrames: videoMeta.totalFrames,
      phaseProgress: 0,
      totalElapsed: performance.now() - startTime,
    })

    const url = videoMeta.path
    const video = document.createElement('video')
    video.muted = true

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error(`Failed to load ${videoMeta.filename}`))
      video.src = url
      video.load()
    })

    const W = video.videoWidth || videoMeta.width
    const H = video.videoHeight || videoMeta.height
    const fps = videoMeta.fps

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    const phases: PhaseResult[] = []
    const t0 = performance.now()

    for (const phaseName of ['forward', 'backward', 'random'] as const) {
      const indices = Array.from({ length: videoMeta.totalFrames }, (_, i) => i)
      if (phaseName === 'backward') indices.reverse()
      else if (phaseName === 'random') indices.sort(() => Math.random() - 0.5)

      const frames: FrameResult[] = []
      let matches = 0
      let totalSeekMs = 0

      for (let idx = 0; idx < indices.length; idx++) {
        const px = indices[idx]
        const expX = px % W
        const expY = Math.floor(px / W)

        const seekStart = performance.now()
        await seekTo(video, (px + 0.75) / fps)
        const { x: foundX, y: foundY, brightness: maxBrightness } = scanFrame(video, ctx, W, H)
        totalSeekMs += performance.now() - seekStart

        const ok = maxBrightness > 200 && foundX === expX && foundY === expY
        frames.push({
          index: px,
          expected: { x: expX, y: expY },
          found: maxBrightness > 10 ? { x: foundX, y: foundY } : null,
          brightness: maxBrightness,
          ok,
          offByOne: false,
        })
        if (ok) matches++

        const elapsed = performance.now() - startTime
        cbs.onStateUpdate({
          phase: phaseName,
          phaseFrameIndex: idx,
          phaseTotalFrames: videoMeta.totalFrames,
          phaseProgress: ((idx + 1) / videoMeta.totalFrames) * 100,
          totalProgress: ((vi * 3 + ['forward', 'backward', 'random'].indexOf(phaseName) + (idx + 1) / videoMeta.totalFrames) / (videos.length * 3)) * 100,
          totalElapsed: elapsed,
        })

        if (idx % 10 === 0) await new Promise(r => setTimeout(r, 0))
      }

      const offByOneCount = markOffByOne(frames)
      matches += offByOneCount
      const elapsed = (performance.now() - t0) / 1000

      phases.push({
        phase: phaseName,
        matches,
        offByOneCount,
        accuracy: (matches / videoMeta.totalFrames) * 100,
        avgSeekMs: videoMeta.totalFrames ? totalSeekMs / videoMeta.totalFrames : 0,
        processingFps: elapsed > 0 ? videoMeta.totalFrames / elapsed : 0,
        frames,
      })
    }

    const result: TestResult = {
      video: videoMeta,
      phases,
      stats: phases.map(p => ({
        matches: p.matches,
        offByOneCount: p.offByOneCount,
        accuracy: p.accuracy,
        avgSeekMs: p.avgSeekMs,
        processingFps: p.processingFps,
      })),
      startedAt: videoStart,
      finishedAt: performance.now(),
    }

    results.push(result)
    cbs.onResult?.(result)
    video.remove()
  }

  return results
}