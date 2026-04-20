export function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return percentile(sorted, 50)
}

export function percentile(sortedValues: number[], p: number): number {
  return sortedValues[Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1)]
}

export function standardDeviation(values: number[]): number {
  const avg = mean(values)
  return Math.sqrt(values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length)
}

export function interquartileRange(sortedValues: number[]): number {
  return percentile(sortedValues, 75) - percentile(sortedValues, 25)
}
