import type { BenchmarkResult } from '@/entities/benchmark-result/model/types'
import type { BrowserProfile } from '@/entities/browser-profile/model/types'

export interface BenchmarkSnapshot {
  version: string
  timestamp: string
  profile: BrowserProfile
  results: BenchmarkResult[]
}

export function buildBenchmarkSnapshot(results: BenchmarkResult[], profile: BrowserProfile): BenchmarkSnapshot {
  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    profile,
    results,
  }
}

export function serializeBenchmarkSnapshot(snapshot: BenchmarkSnapshot): string {
  return JSON.stringify(snapshot, null, 2)
}

export function parseBenchmarkSnapshot(json: string): BenchmarkSnapshot {
  return JSON.parse(json)
}
