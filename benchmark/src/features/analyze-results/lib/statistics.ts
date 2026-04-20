import type { SeekMeasurement, SeekStats } from '@/entities/benchmark-result/model/types'
import { mean, median, percentile, standardDeviation, interquartileRange } from '@/shared/lib/math'
import { linearRegression } from './regression'

export function computeSeekStats(seeks: SeekMeasurement[]): SeekStats {
  const times = seeks.map((s) => s.seekTimeMs)
  const sorted = [...times].sort((a, b) => a - b)
  const avg = mean(times)
  const med = median(times)
  const p95 = percentile(sorted, 95)
  const p99 = percentile(sorted, 99)
  const stdDev = standardDeviation(times)
  const totalDurationMs = times.reduce((a, b) => a + b, 0)
  const seekFPS = totalDurationMs > 0 ? (seeks.length / totalDurationMs) * 1000 : 0
  const consistencyScore = avg > 0 ? Math.max(0, Math.min(100, 100 * (1 - stdDev / avg))) : 0
  const degradationFactor = med > 0 ? p99 / med : 0
  const subsequentMean = seeks.length > 1 ? mean(seeks.slice(1).map((s) => s.seekTimeMs)) : avg
  const coldStartPenaltyMs = seeks[0].seekTimeMs - subsequentMean
  const stallCount = seeks.filter((s) => s.isStall).length
  const driftMeanSec = mean(seeks.map((s) => s.seekDriftSec))
  const tabVisibilityInterruptions = seeks.filter((s) => s.tabVisibilityInterrupted).length
  const indices = seeks.map((s) => s.seekIndex)
  const { slope: linearRegressionSlope, r2 } = linearRegression(indices, times)

  return {
    mean: avg,
    median: med,
    p95,
    p99,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    iqr: interquartileRange(sorted),
    seekFPS,
    consistencyScore,
    degradationFactor,
    coldStartPenaltyMs,
    stallCount,
    driftMeanSec,
    linearRegressionSlope,
    r2,
    tabVisibilityInterruptions,
  }
}
