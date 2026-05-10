import type { TestResult, BrowserProfile } from '@/entities/test-result/types'

export function buildAggregatedCsv(results: TestResult[], profile: BrowserProfile): string {
  const sep = ','
  const rows: string[] = []

  rows.push([
    'date', 'browserName', 'browserVersion', 'os', 'gpu', 'gpuVendor',
    'cores', 'memoryGB', 'screen',
    'videoFile', 'width', 'height', 'fps', 'codec',
    'totalFrames', 'durationSec',
    'phase',
    'matches', 'offByOneCount', 'accuracy', 'avgSeekMs', 'processingFps',
    'totalMatches', 'totalAccuracy', 'totalOffByOne', 'totalAvgSeekMs',
    'totalProcessingFps',
    'jsHeapUsedMB', 'timingResolutionNs',
  ].join(sep))

  for (const r of results) {
    const v = r.video
    const totalMatches = r.phases.reduce((s, p) => s + p.matches, 0)
    const totalOffByOne = r.phases.reduce((s, p) => s + p.offByOneCount, 0)
    const totalAccuracy = (totalMatches / (r.phases[0]?.frames.length ?? 1) / 3) * 100
    const totalAvgSeekMs = r.phases.reduce((s, p) => s + p.avgSeekMs, 0) / 3
    const totalProcessingFps = r.phases.reduce((s, p) => s + p.processingFps, 0) / 3

    for (const p of r.phases) {
      rows.push([
        r.startedAt ? new Date(r.startedAt).toISOString().slice(0, 19) : '',
        profile.browserName,
        profile.browserVersion,
        profile.os,
        profile.gpu,
        profile.gpuVendor,
        String(profile.cores),
        String(profile.memoryGB),
        profile.screen,
        v.filename,
        String(v.width),
        String(v.height),
        String(v.fps),
        v.codec,
        String(v.totalFrames),
        v.durationSec.toFixed(1),
        p.phase,
        String(p.matches),
        String(p.offByOneCount),
        p.accuracy.toFixed(2),
        p.avgSeekMs.toFixed(2),
        p.processingFps.toFixed(2),
        String(totalMatches),
        totalAccuracy.toFixed(2),
        String(totalOffByOne),
        totalAvgSeekMs.toFixed(2),
        totalProcessingFps.toFixed(2),
        String(profile.jsHeapUsedMB),
        String(profile.timingResolutionNs),
      ].join(sep))
    }
  }

  return rows.join('\n')
}

export function buildRawCsv(results: TestResult[], profile: BrowserProfile): string {
  const sep = ','
  const rows: string[] = []

  rows.push([
    'date', 'browserName', 'browserVersion', 'os', 'gpu',
    'videoFile', 'width', 'height', 'fps', 'codec',
    'phase', 'frameIndex', 'frameX', 'frameY',
    'foundX', 'foundY', 'brightness',
    'ok', 'offByOne',
    'seekMs', 'processingFps',
  ].join(sep))

  for (const r of results) {
    const v = r.video
    for (const phase of r.phases) {
      for (const f of phase.frames) {
        rows.push([
          r.startedAt ? new Date(r.startedAt).toISOString().slice(0, 19) : '',
          profile.browserName,
          profile.browserVersion,
          profile.os,
          profile.gpu,
          v.filename,
          String(v.width),
          String(v.height),
          String(v.fps),
          v.codec,
          phase.phase,
          String(f.index),
          String(f.expected.x),
          String(f.expected.y),
          f.found ? String(f.found.x) : '',
          f.found ? String(f.found.y) : '',
          String(f.brightness),
          String(f.ok),
          String(f.offByOne),
          phase.avgSeekMs.toFixed(2),
          phase.processingFps.toFixed(2),
        ].join(sep))
      }
    }
  }

  return rows.join('\n')
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}