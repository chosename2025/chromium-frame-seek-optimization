import { ref } from 'vue'
import type { BrowserProfile } from '@/entities/browser-profile/model/types'
import { collectGpu } from '../lib/collectGpu'
import { collectCodecs } from '../lib/collectCodecs'
import { collectDecodingCapabilities } from '../lib/collectDecodingCapabilities'

function parseBrowserName(ua: string): string {
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari')) return 'Safari'
  return 'Unknown'
}

function parseBrowserVersion(ua: string, name: string): string {
  const patterns: Record<string, RegExp> = {
    Edge: /Edg\/([\d.]+)/,
    Opera: /(?:OPR|Opera)\/([\d.]+)/,
    Chrome: /Chrome\/([\d.]+)/,
    Firefox: /Firefox\/([\d.]+)/,
    Safari: /Version\/([\d.]+)/,
  }
  const match = patterns[name]?.exec(ua)
  return match?.[1] ?? 'unknown'
}

function parseOs(ua: string): { os: string; osVersion: string } {
  if (ua.includes('Windows NT 10.0')) return { os: 'Windows', osVersion: '10/11' }
  if (ua.includes('Windows NT 6.3')) return { os: 'Windows', osVersion: '8.1' }
  if (ua.includes('Windows')) return { os: 'Windows', osVersion: 'unknown' }
  const macMatch = /Mac OS X ([\d_]+)/.exec(ua)
  if (macMatch) return { os: 'macOS', osVersion: macMatch[1].replace(/_/g, '.') }
  const linuxMatch = /Linux/.test(ua)
  if (linuxMatch) return { os: 'Linux', osVersion: 'unknown' }
  const androidMatch = /Android ([\d.]+)/.exec(ua)
  if (androidMatch) return { os: 'Android', osVersion: androidMatch[1] }
  const iosMatch = /OS ([\d_]+) like Mac/.exec(ua)
  if (iosMatch) return { os: 'iOS', osVersion: iosMatch[1].replace(/_/g, '.') }
  return { os: 'Unknown', osVersion: 'unknown' }
}

async function measureTimingResolution(): Promise<number> {
  const samples: number[] = []
  for (let i = 0; i < 10; i++) {
    const start = performance.now()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    samples.push(performance.now() - start)
  }
  return samples.reduce((sum, v) => sum + v, 0) / samples.length
}

export function useBrowserProfile() {
  const profile = ref<BrowserProfile | null>(null)
  const isCollecting = ref(false)

  async function collect(): Promise<BrowserProfile> {
    isCollecting.value = true
    const ua = navigator.userAgent
    const browserName = parseBrowserName(ua)
    const { os, osVersion } = parseOs(ua)
    const nav = navigator as Navigator & {
      deviceMemory?: number
      connection?: { effectiveType?: string; downlink?: number }
    }
    const perf = performance as Performance & {
      memory?: { jsHeapSizeLimit: number; usedJSHeapSize: number }
    }
    const [decodingCapabilities, timingResolution] = await Promise.all([
      collectDecodingCapabilities(),
      measureTimingResolution(),
    ])
    const result: BrowserProfile = {
      userAgent: ua,
      browserName,
      browserVersion: parseBrowserVersion(ua, browserName),
      os,
      osVersion,
      hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
      deviceMemory: nav.deviceMemory ?? 0,
      devicePixelRatio: window.devicePixelRatio ?? 1,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      gpu: collectGpu(),
      codecs: collectCodecs(),
      decodingCapabilities,
      connectionEffectiveType: nav.connection?.effectiveType ?? 'unknown',
      connectionDownlink: nav.connection?.downlink ?? 0,
      jsHeapSizeLimitMB: perf.memory ? perf.memory.jsHeapSizeLimit / 1048576 : 0,
      usedJSHeapSizeMB: perf.memory ? perf.memory.usedJSHeapSize / 1048576 : 0,
      performanceTimingResolutionMs: timingResolution,
    }
    profile.value = result
    isCollecting.value = false
    return result
  }

  return { profile, isCollecting, collect }
}
