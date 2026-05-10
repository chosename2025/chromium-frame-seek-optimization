import type { BrowserProfile } from '@/entities/test-result/types'

function parseUA(ua: string): { name: string; version: string } {
  if (ua.includes('Firefox/')) {
    const v = ua.match(/Firefox\/(\d+(\.\d+)?)/)?.[1] ?? ''
    return { name: 'Firefox', version: v }
  }
  if (ua.includes('Edg/')) {
    const v = ua.match(/Edg\/(\d+(\.\d+)?)/)?.[1] ?? ''
    return { name: 'Edge', version: v }
  }
  if (ua.includes('OPR/') || ua.includes('Opera')) {
    const v = ua.match(/(?:OPR|Opera)\/(\d+(\.\d+)?)/)?.[1] ?? ''
    return { name: 'Opera', version: v }
  }
  if (ua.includes('Chrome/') && !ua.includes('Chromium')) {
    const v = ua.match(/Chrome\/(\d+(\.\d+)?)/)?.[1] ?? ''
    return { name: 'Chrome', version: v }
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const v = ua.match(/Version\/(\d+(\.\d+)?)/)?.[1] ?? ''
    return { name: 'Safari', version: v }
  }
  return { name: 'Unknown', version: '' }
}

function parseOS(ua: string): string {
  if (/Windows/.test(ua)) {
    const v = ua.match(/Windows NT ([\d.]+)/)?.[1] ?? ''
    const map: Record<string, string> = { '10.0': '10', '11.0': '11', '6.3': '8.1' }
    return 'Windows ' + (map[v] ?? v)
  }
  if (/Mac OS X/.test(ua)) {
    const v = ua.match(/Mac OS X ([\d_.]+)/)?.[1]?.replace(/_/g, '.') ?? ''
    return 'macOS ' + v
  }
  if (/Linux/.test(ua)) return 'Linux'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad/.test(ua)) return 'iOS'
  return 'Unknown'
}

function collectGPU(): { gpu: string; vendor: string } {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null
    if (!ctx) return { gpu: 'Unknown', vendor: 'Unknown' }
    const ext = ctx.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return { gpu: ctx.getParameter(ctx.RENDERER), vendor: ctx.getParameter(ctx.VENDOR) }
    return {
      gpu: ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? 'Unknown',
      vendor: ctx.getParameter(ext.UNMASKED_VENDOR_WEBGL) ?? 'Unknown',
    }
  } catch {
    return { gpu: 'Unknown', vendor: 'Unknown' }
  }
}

function collectCodecs(): string[] {
  const codecs: string[] = []
  const tests = [
    { mime: 'video/mp4; codecs="avc1.42E01E"', label: 'H.264 Baseline' },
    { mime: 'video/mp4; codecs="avc1.640029"', label: 'H.264 High' },
    { mime: 'video/webm; codecs="vp8"', label: 'VP8' },
    { mime: 'video/webm; codecs="vp9"', label: 'VP9' },
    { mime: 'video/webm; codecs="av01.0.04M.08"', label: 'AV1' },
  ]
  for (const t of tests) {
    const v = document.createElement('video')
    if (v.canPlayType(t.mime)) codecs.push(t.label)
  }
  return codecs
}

function measureTimingResolution(): Promise<number> {
  return new Promise(resolve => {
    const samples: number[] = []
    let prev = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      samples.push(now - prev)
      prev = now
      if (samples.length >= 20) {
        clearInterval(id)
        const min = Math.min(...samples)
        resolve(min * 1e6)
      }
    }, 0)
    setTimeout(() => { clearInterval(id); resolve(0) }, 200)
  })
}

function getHeapMB(): number {
  const m = (performance as Performance & { memory?: { usedJSHeapSizeMB: number } }).memory
  return m ? Math.round(m.usedJSHeapSizeMB) : -1
}

export async function collectBrowserProfile(): Promise<BrowserProfile> {
  const ua = navigator.userAgent
  const { name, version } = parseUA(ua)
  const { gpu, vendor } = collectGPU()

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? -1

  const [codecs, timingNs] = await Promise.all([
    Promise.resolve(collectCodecs()),
    measureTimingResolution(),
  ])

  return {
    userAgent: ua,
    browserName: name,
    browserVersion: version,
    os: parseOS(ua),
    gpu,
    gpuVendor: vendor,
    cores: navigator.hardwareConcurrency,
    memoryGB: mem,
    screen: `${screen.width}x${screen.height}`,
    codecs,
    jsHeapUsedMB: getHeapMB(),
    timingResolutionNs: Math.round(timingNs),
    startedAt: new Date().toISOString(),
  }
}