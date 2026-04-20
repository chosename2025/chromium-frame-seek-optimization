export type Resolution = '480p' | '720p' | '1080p' | '2160p'
export type Fps = 30 | 60
export type IframeMultiplier = 1 | 10 | 20 | 'all' | 'one'
export type DurationSec = 7 | 60

export interface VideoMeta {
  url: string
  filename: string
  resolution: Resolution
  fps: Fps
  iframeMultiplier: IframeMultiplier
  hasAudio: boolean
  sizeMB: number
  iframes: number
  pframes: number
  bframes: number
  durationSec: DurationSec
}
