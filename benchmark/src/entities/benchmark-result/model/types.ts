import type { VideoMeta } from '@/entities/video/model/types'

export type SeekPattern = 'frame'

export interface SeekMeasurement {
  seekIndex: number
  fromTimeSec: number
  toTimeSec: number
  seekDistanceSec: number
  seekTimeMs: number
  wallClockMs: number
  estimatedFrameIndex: number
  seekDriftSec: number
  jsHeapUsedMB: number
  isColdStart: boolean
  isStall: boolean
  tabVisibilityInterrupted: boolean
}

export interface SeekStats {
  mean: number
  median: number
  p95: number
  p99: number
  stdDev: number
  min: number
  max: number
  iqr: number
  seekFPS: number
  consistencyScore: number
  degradationFactor: number
  coldStartPenaltyMs: number
  stallCount: number
  driftMeanSec: number
  linearRegressionSlope: number
  r2: number
  tabVisibilityInterruptions: number
}

export interface BenchmarkResult {
  video: VideoMeta
  pattern: SeekPattern
  seeks: SeekMeasurement[]
  stats: SeekStats
  startedAtMs: number
  finishedAtMs: number
}
