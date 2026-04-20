import type { BenchmarkResult } from '@/entities/benchmark-result/model/types'
import type { BrowserProfile } from '@/entities/browser-profile/model/types'

function csvField(value: string | number | boolean): string {
  const str = String(value)
  return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str
}

const RAW_HEADER =
  'timestamp,browser,browserVersion,os,gpu,cores,memGB,videoFile,resolution,fps,hasAudio,sizeMB,iframes,pframes,bframes,iframeMultiplier,durationSec,seekPattern,seekIndex,fromTimeSec,toTimeSec,seekDistanceSec,seekTimeMs,estimatedFrameIndex,seekDriftSec,jsHeapUsedMB,isColdStart,isStall,tabInterrupted,mean,median,p95,p99,stdDev,min,max,seekFPS,consistencyScore,degradationFactor,linearSlope,r2'

export function buildRawCsv(results: BenchmarkResult[], profile: BrowserProfile): string {
  const timestamp = new Date().toISOString()
  const rows: string[] = [RAW_HEADER]
  for (const result of results) {
    const { video, pattern, seeks, stats } = result
    const baseFields = [
      timestamp,
      profile.browserName,
      profile.browserVersion,
      `${profile.os} ${profile.osVersion}`,
      profile.gpu.renderer,
      profile.hardwareConcurrency,
      profile.deviceMemory,
      video.filename,
      video.resolution,
      video.fps,
      video.hasAudio,
      video.sizeMB,
      video.iframes,
      video.pframes,
      video.bframes,
      video.iframeMultiplier,
      video.durationSec,
      pattern,
    ].map(csvField)

    const statsFields = [
      stats.mean,
      stats.median,
      stats.p95,
      stats.p99,
      stats.stdDev,
      stats.min,
      stats.max,
      stats.seekFPS,
      stats.consistencyScore,
      stats.degradationFactor,
      stats.linearRegressionSlope,
      stats.r2,
    ].map(csvField)

    for (const seek of seeks) {
      const seekFields = [
        seek.seekIndex,
        seek.fromTimeSec,
        seek.toTimeSec,
        seek.seekDistanceSec,
        seek.seekTimeMs,
        seek.estimatedFrameIndex,
        seek.seekDriftSec,
        seek.jsHeapUsedMB,
        seek.isColdStart,
        seek.isStall,
        seek.tabVisibilityInterrupted,
      ].map(csvField)
      rows.push([...baseFields, ...seekFields, ...statsFields].join(','))
    }
  }
  return rows.join('\n')
}

const AGGREGATED_HEADER =
  'browser,browserVersion,os,gpu,videoFile,resolution,fps,hasAudio,sizeMB,iframes,iframeMultiplier,durationSec,seekPattern,mean,median,p95,p99,stdDev,min,max,seekFPS,consistencyScore,degradationFactor,coldStartPenaltyMs,stallCount,driftMeanSec,linearSlope,r2,tabVisibilityInterruptions'

export function buildAggregatedCsv(results: BenchmarkResult[], profile: BrowserProfile): string {
  const rows: string[] = [AGGREGATED_HEADER]
  for (const result of results) {
    const { video, pattern, stats } = result
    rows.push(
      [
        profile.browserName,
        profile.browserVersion,
        `${profile.os} ${profile.osVersion}`,
        profile.gpu.renderer,
        video.filename,
        video.resolution,
        video.fps,
        video.hasAudio,
        video.sizeMB,
        video.iframes,
        video.iframeMultiplier,
        video.durationSec,
        pattern,
        stats.mean,
        stats.median,
        stats.p95,
        stats.p99,
        stats.stdDev,
        stats.min,
        stats.max,
        stats.seekFPS,
        stats.consistencyScore,
        stats.degradationFactor,
        stats.coldStartPenaltyMs,
        stats.stallCount,
        stats.driftMeanSec,
        stats.linearRegressionSlope,
        stats.r2,
        stats.tabVisibilityInterruptions,
      ]
        .map(csvField)
        .join(','),
    )
  }
  return rows.join('\n')
}
