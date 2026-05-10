export interface VideoManifestItem {
  filename: string
  path: string
  width: number
  height: number
  fps: number
  codec: 'H.264' | 'VP9'
  totalFrames: number
  durationSec: number
}

export interface FrameResult {
  index: number
  expected: { x: number; y: number }
  found: { x: number; y: number } | null
  brightness: number
  ok: boolean
  offByOne: boolean
}

export interface PhaseResult {
  phase: 'forward' | 'backward' | 'random'
  matches: number
  offByOneCount: number
  accuracy: number
  avgSeekMs: number
  processingFps: number
  frames: FrameResult[]
}

export interface PhaseStats {
  matches: number
  offByOneCount: number
  accuracy: number
  avgSeekMs: number
  processingFps: number
}

export interface TestResult {
  video: VideoManifestItem
  phases: PhaseResult[]
  stats: PhaseStats[]
  startedAt: number
  finishedAt: number
}

export interface BrowserProfile {
  userAgent: string
  browserName: string
  browserVersion: string
  os: string
  gpu: string
  gpuVendor: string
  cores: number
  memoryGB: number
  screen: string
  codecs: string[]
  jsHeapUsedMB: number
  timingResolutionNs: number
  startedAt: string
}