import { ref } from 'vue'
import type { VideoMeta } from '@/entities/video/model/types'
import type { BenchmarkResult, SeekMeasurement, SeekPattern } from '@/entities/benchmark-result/model/types'
import { computeSeekStats } from '@/features/analyze-results/lib/statistics'
import { SEEK_STALL_THRESHOLD_MS } from '@/shared/constants/benchmark'

function buildFrameTimestamps(durationSec: number, fps: number): number[] {
  const step = 1 / fps
  const timestamps: number[] = []
  for (let t = 0; t < durationSec; t += step) {
    timestamps.push(Math.min(t, durationSec - 0.001))
  }
  return timestamps
}

async function loadVideo(url: string): Promise<{ video: HTMLVideoElement; blobUrl: string }> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch video: ${url}`)
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const onCanPlay = () => {
      video.removeEventListener('canplaythrough', onCanPlay)
      video.removeEventListener('error', onError)
      resolve({ video, blobUrl })
    }
    const onError = () => {
      video.removeEventListener('canplaythrough', onCanPlay)
      video.removeEventListener('error', onError)
      URL.revokeObjectURL(blobUrl)
      reject(new Error(`Failed to load video: ${url}`))
    }
    video.addEventListener('canplaythrough', onCanPlay)
    video.addEventListener('error', onError)
    video.preload = 'auto'
    video.muted = true
    video.src = blobUrl
    video.load()
  })
}

function removeVideo(video: HTMLVideoElement, blobUrl: string): void {
  video.pause()
  video.src = ''
  video.load()
  URL.revokeObjectURL(blobUrl)
}

function runPattern(
  video: HTMLVideoElement,
  timestamps: number[],
  fps: number,
  tabVisibilityFlag: { interrupted: boolean },
  isStopped: () => boolean,
): Promise<SeekMeasurement[]> {
  return new Promise((resolve) => {
    const rawTimes: number[] = []
    let seekIndex = 0
    let seekStartTime = 0

    const onSeeked = () => {
      rawTimes.push(performance.now() - seekStartTime)
      seekIndex++

      if (seekIndex < timestamps.length && !isStopped()) {
        seekStartTime = performance.now()
        video.currentTime = timestamps[seekIndex]
      } else {
        video.removeEventListener('seeked', onSeeked)

        // Build measurements after all seeks complete — no overhead in hot path
        const measurements: SeekMeasurement[] = []
        let wasInterrupted = false
        for (let i = 0; i < rawTimes.length; i++) {
          const interrupted = tabVisibilityFlag.interrupted
          tabVisibilityFlag.interrupted = false
          const seekTimeMs = rawTimes[i]
          const targetTime = timestamps[i]
          const fromTime = i === 0 ? 0 : timestamps[i - 1]
          measurements.push({
            seekIndex: i,
            fromTimeSec: fromTime,
            toTimeSec: targetTime,
            seekDistanceSec: Math.abs(targetTime - fromTime),
            seekTimeMs,
            wallClockMs: 0,
            estimatedFrameIndex: Math.round(targetTime * fps),
            seekDriftSec: 0,
            jsHeapUsedMB: 0,
            isColdStart: i === 0,
            isStall: seekTimeMs > SEEK_STALL_THRESHOLD_MS,
            tabVisibilityInterrupted: wasInterrupted,
          })
          wasInterrupted = wasInterrupted || interrupted
        }
        resolve(measurements)
      }
    }

    video.addEventListener('seeked', onSeeked)
    seekStartTime = performance.now()
    video.currentTime = timestamps[0]
  })
}

export function useBenchmark() {
  const isRunning = ref(false)
  const progress = ref({ current: 0, total: 0, currentVideo: '' })
  const results = ref<BenchmarkResult[]>([])
  const liveSeeks = ref<SeekMeasurement[]>([])
  const currentVideoEl = ref<HTMLVideoElement | null>(null)
  let stopped = false

  function stop(): void {
    stopped = true
    isRunning.value = false
  }

  async function run(selectedVideos: VideoMeta[]): Promise<void> {
    stopped = false
    isRunning.value = true
    results.value = []
    liveSeeks.value = []

    const patterns: SeekPattern[] = ['frame']
    const totalSteps = selectedVideos.length * patterns.length
    progress.value = { current: 0, total: totalSteps, currentVideo: '' }

    const tabVisibilityFlag = { interrupted: false }
    const onVisibilityChange = () => {
      if (document.hidden) tabVisibilityFlag.interrupted = true
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    try {
      for (const videoMeta of selectedVideos) {
        if (stopped) break
        progress.value.currentVideo = videoMeta.filename

        let videoEl: HTMLVideoElement
        let blobUrl: string
        try {
          ;({ video: videoEl, blobUrl } = await loadVideo(videoMeta.url))
          currentVideoEl.value = videoEl
        } catch {
          progress.value.current += patterns.length
          continue
        }

        for (const _ of patterns) {
          if (stopped) break
          progress.value.current++

          const timestamps = buildFrameTimestamps(videoMeta.durationSec, videoMeta.fps)

          const startedAtMs = Date.now()
          const seeks = await runPattern(
            videoEl,
            timestamps,
            videoMeta.fps,
            tabVisibilityFlag,
            () => stopped,
          )
          const finishedAtMs = Date.now()

          liveSeeks.value = seeks

          if (seeks.length > 0) {
            const stats = computeSeekStats(seeks)
            results.value.push({ video: videoMeta, pattern: 'frame', seeks, stats, startedAtMs, finishedAtMs })
          }
        }

        currentVideoEl.value = null
        removeVideo(videoEl, blobUrl)
      }
    } finally {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      isRunning.value = false
    }
  }

  return { isRunning, progress, results, liveSeeks, currentVideoEl, run, stop }
}
