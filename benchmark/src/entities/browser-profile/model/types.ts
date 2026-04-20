export interface GpuInfo {
  renderer: string
  vendor: string
  version: string
}

export interface DecodingCapability {
  supported: boolean
  smooth: boolean
  powerEfficient: boolean
}

export interface BrowserProfile {
  userAgent: string
  browserName: string
  browserVersion: string
  os: string
  osVersion: string
  hardwareConcurrency: number
  deviceMemory: number
  devicePixelRatio: number
  screenResolution: string
  colorDepth: number
  gpu: GpuInfo
  codecs: Record<string, 'probably' | 'maybe' | ''>
  decodingCapabilities: Record<string, DecodingCapability>
  connectionEffectiveType: string
  connectionDownlink: number
  jsHeapSizeLimitMB: number
  usedJSHeapSizeMB: number
  performanceTimingResolutionMs: number
}
