import type { BenchmarkResult } from '@/entities/benchmark-result/model/types'
import type { BrowserProfile } from '@/entities/browser-profile/model/types'

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`
}

export function buildReadme(results: BenchmarkResult[], profile: BrowserProfile): string {
  const timestamp = new Date().toISOString()
  const sequentialResults = results.filter((r) => r.pattern === 'frame')

  const worstResult = sequentialResults.reduce(
    (worst, r) => (r.stats.mean > worst.stats.mean ? r : worst),
    sequentialResults[0],
  )

  const bestResult = sequentialResults.reduce(
    (best, r) => (r.stats.mean < best.stats.mean ? r : best),
    sequentialResults[0],
  )

  const degradingResults = results.filter((r) => r.stats.linearRegressionSlope > 1.0 && r.stats.r2 > 0.7)

  const totalStalls = results.reduce((sum, r) => sum + r.stats.stallCount, 0)

  const coldStartPenalties = results.map((r) => r.stats.coldStartPenaltyMs)
  const avgColdStartPenalty = coldStartPenalties.reduce((a, b) => a + b, 0) / coldStartPenalties.length

  const lines: string[] = []

  lines.push('Browser Video Seeking Benchmark Report')
  lines.push('---')
  lines.push(`Generated: ${timestamp}`)
  lines.push('')
  lines.push('BROWSER ENVIRONMENT')
  lines.push('---')
  lines.push(`Browser: ${profile.browserName} ${profile.browserVersion}`)
  lines.push(`OS: ${profile.os} ${profile.osVersion}`)
  lines.push(`GPU: ${profile.gpu.vendor} / ${profile.gpu.renderer}`)
  lines.push(`CPU cores: ${profile.hardwareConcurrency}`)
  lines.push(`Device memory: ${profile.deviceMemory} GB`)
  lines.push(`Screen: ${profile.screenResolution} @ ${profile.devicePixelRatio}x`)
  lines.push(`Connection: ${profile.connectionEffectiveType} (${profile.connectionDownlink} Mbps)`)
  lines.push(`JS heap limit: ${profile.jsHeapSizeLimitMB.toFixed(0)} MB`)
  lines.push(`Timer resolution: ${profile.performanceTimingResolutionMs.toFixed(3)}ms`)
  lines.push('')
  lines.push('BENCHMARK SUMMARY')
  lines.push('---')
  lines.push(`Total results: ${results.length} (video x pattern combinations)`)
  lines.push(`Total stalls (>${500}ms): ${totalStalls}`)
  lines.push(`Average cold start penalty: ${formatMs(avgColdStartPenalty)}`)
  lines.push('')

  if (worstResult) {
    lines.push('WORST SEEK PERFORMANCE')
    lines.push('---')
    lines.push(`Video: ${worstResult.video.filename}`)
    lines.push(`Resolution: ${worstResult.video.resolution} @ ${worstResult.video.fps}fps`)
    lines.push(`I-frame multiplier: ${worstResult.video.iframeMultiplier}`)
    lines.push(`I-frames: ${worstResult.video.iframes}`)
    lines.push(`Mean seek time: ${formatMs(worstResult.stats.mean)}`)
    lines.push(`P99 seek time: ${formatMs(worstResult.stats.p99)}`)
    lines.push(
      `Analysis: Higher iframe density typically reduces seek latency by providing more decode entry points. ` +
        `Low iframe count forces the decoder to traverse more frames from the nearest keyframe.`,
    )
    lines.push('')
  }

  if (bestResult) {
    lines.push('BEST SEEK PERFORMANCE')
    lines.push('---')
    lines.push(`Video: ${bestResult.video.filename}`)
    lines.push(`Resolution: ${bestResult.video.resolution} @ ${bestResult.video.fps}fps`)
    lines.push(`I-frame multiplier: ${bestResult.video.iframeMultiplier}`)
    lines.push(`Mean seek time: ${formatMs(bestResult.stats.mean)}`)
    lines.push(`Seek FPS: ${bestResult.stats.seekFPS.toFixed(2)}`)
    lines.push(`Consistency score: ${bestResult.stats.consistencyScore.toFixed(1)}/100`)
    lines.push('')
  }

  lines.push('O(N) DEGRADATION ANALYSIS')
  lines.push('---')
  if (degradingResults.length > 0) {
    lines.push(
      `O(n) degradation detected in ${degradingResults.length} video/pattern combination(s).`,
    )
    lines.push(
      `This confirms Chromium seek complexity is O(n) relative to seek index, producing O(n^2) total frame extraction cost.`,
    )
    for (const r of degradingResults) {
      lines.push(
        `  ${r.video.filename} [${r.pattern}]: slope=${r.stats.linearRegressionSlope.toFixed(4)}, R2=${r.stats.r2.toFixed(4)}`,
      )
    }
  } else {
    lines.push(
      `No statistically significant O(n) degradation detected (slope > 1.0 and R2 > 0.7 threshold not met).`,
    )
    lines.push(
      `This may indicate sufficient iframe density, short video duration, or a browser with O(1) seek implementation.`,
    )
  }
  lines.push('')

  lines.push('COLD START PENALTY')
  lines.push('---')
  lines.push(
    `Average cold start penalty across all videos: ${formatMs(avgColdStartPenalty)}`,
  )
  lines.push(
    `Cold start penalty measures the extra latency of the first seek versus the mean of subsequent seeks.`,
  )
  lines.push(
    `A large penalty indicates significant decoder initialization overhead.`,
  )
  lines.push('')

  lines.push('STALL SUMMARY')
  lines.push('---')
  lines.push(`Total stalls detected: ${totalStalls}`)
  lines.push(`A stall is defined as a seek taking longer than 500ms.`)
  if (totalStalls > 0) {
    const stalledVideos = results
      .filter((r) => r.stats.stallCount > 0)
      .map((r) => `${r.video.filename} [${r.pattern}]: ${r.stats.stallCount} stall(s)`)
    for (const s of stalledVideos) {
      lines.push(`  ${s}`)
    }
  }
  lines.push('')

  lines.push('CODEC SUPPORT')
  lines.push('---')
  for (const [codec, support] of Object.entries(profile.codecs)) {
    lines.push(`  ${codec}: ${support || 'not supported'}`)
  }
  lines.push('')

  lines.push('HARDWARE DECODING CAPABILITIES')
  lines.push('---')
  for (const [label, cap] of Object.entries(profile.decodingCapabilities)) {
    lines.push(
      `  ${label}: supported=${cap.supported}, smooth=${cap.smooth}, powerEfficient=${cap.powerEfficient}`,
    )
  }

  return lines.join('\n')
}
