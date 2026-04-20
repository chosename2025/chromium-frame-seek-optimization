import { ref } from 'vue'
import type { BenchmarkResult } from '@/entities/benchmark-result/model/types'
import type { BrowserProfile } from '@/entities/browser-profile/model/types'
import { buildRawCsv } from '../lib/buildCsv'
import { buildBenchmarkSnapshot, serializeBenchmarkSnapshot, parseBenchmarkSnapshot } from '../lib/buildBenchmarkFile'
import type { BenchmarkSnapshot } from '../lib/buildBenchmarkFile'

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function timestampedFilename(base: string, ext: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${base}-${ts}.${ext}`
}

export function useExport() {
  const lastExportTimestamp = ref<string | null>(null)
  const lastExportSizeBytes = ref<number>(0)
  const isExporting = ref(false)

  function exportCsv(results: BenchmarkResult[], profile: BrowserProfile): void {
    const csv = buildRawCsv(results, profile)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    lastExportSizeBytes.value = blob.size
    lastExportTimestamp.value = new Date().toISOString()
    triggerDownload(blob, timestampedFilename('benchmark-seeks', 'csv'))
  }

  function exportBenchmark(results: BenchmarkResult[], profile: BrowserProfile): void {
    isExporting.value = true
    try {
      const snapshot = buildBenchmarkSnapshot(results, profile)
      const json = serializeBenchmarkSnapshot(snapshot)
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
      lastExportSizeBytes.value = blob.size
      lastExportTimestamp.value = new Date().toISOString()
      triggerDownload(blob, timestampedFilename('benchmark', 'vsbench'))
    } finally {
      isExporting.value = false
    }
  }

  function loadBenchmark(file: File): Promise<BenchmarkSnapshot> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const json = e.target?.result as string
          const snapshot = parseBenchmarkSnapshot(json)
          resolve(snapshot)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  return { lastExportTimestamp, lastExportSizeBytes, isExporting, exportCsv, exportBenchmark, loadBenchmark }
}
