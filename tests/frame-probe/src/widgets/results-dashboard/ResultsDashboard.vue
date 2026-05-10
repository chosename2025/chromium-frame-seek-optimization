<script setup lang="ts">
import { ref, computed, nextTick, watchEffect } from 'vue'
import { Button } from '@/components/ui/button'
import { downloadCsv, buildAggregatedCsv, buildRawCsv } from '@/features/export-results/lib/buildCsv'
import type { TestResult, BrowserProfile } from '@/entities/test-result/types'
import Chart from 'chart.js/auto'

const props = defineProps<{ results: TestResult[]; browserProfile: BrowserProfile }>()
defineEmits<{ back: [] }>()

const activeTab = ref<'table' | 'charts' | 'profile' | 'export'>('table')
const TABS = ['table', 'charts', 'profile', 'export'] as const

const sortCol = ref('filename')
const sortDir = ref<'asc' | 'desc'>('asc')

const flatRows = computed(() => {
  const rows: {
    id: string; filename: string; width: number; height: number; fps: number; codec: string
    ; phase: string; accuracy: number; matches: number; offByOne: number
    ; avgSeekMs: number; processingFps: number
  }[] = []

  for (const r of props.results) {
    for (const p of r.phases) {
      rows.push({
        id: `${r.video.filename}-${p.phase}`,
        filename: r.video.filename,
        width: r.video.width, height: r.video.height,
        fps: r.video.fps, codec: r.video.codec,
        phase: p.phase,
        accuracy: p.accuracy,
        matches: p.matches,
        offByOne: p.offByOneCount,
        avgSeekMs: p.avgSeekMs,
        processingFps: p.processingFps,
      })
    }
  }

  return rows.sort((a, b) => {
    let va: number | string = a[sortCol.value as keyof typeof a] as number | string
    let vb: number | string = b[sortCol.value as keyof typeof b] as number | string
    if (typeof va === 'string') va = va.toLowerCase()
    if (typeof vb === 'string') vb = vb.toLowerCase()
    if (va < vb) return sortDir.value === 'asc' ? -1 : 1
    if (va > vb) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
})

function setSort(col: string) {
  if (sortCol.value === col) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortCol.value = col; sortDir.value = 'asc' }
}

function accuracyColor(a: number) {
  if (a >= 99) return 'bg-green-500/20 text-green-400'
  if (a >= 90) return 'bg-yellow-500/20 text-yellow-400'
  return 'bg-red-500/20 text-red-400'
}

function fmt(v: number, d = 2) { return v.toFixed(d) }

function doExportAggregated() {
  const csv = buildAggregatedCsv(props.results, props.browserProfile)
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  downloadCsv(csv, `frame-probe-results_${ts}.csv`)
}

function doExportRaw() {
  const csv = buildRawCsv(props.results, props.browserProfile)
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  downloadCsv(csv, `frame-probe-raw_${ts}.csv`)
}

const chartCanvas = ref<HTMLCanvasElement | null>(null)
const chartCanvas2 = ref<HTMLCanvasElement | null>(null)
const chartsDrawn = ref(false)

function drawCharts() {
  if (!chartCanvas.value || !chartCanvas2.value) return

  const labels = props.results.map(r => `${r.video.width}×${r.video.height}`)
  const forwardAcc = props.results.map(r => { const f = r.phases.find(p => p.phase === 'forward'); return f ? f.accuracy : 0 })
  const backwardAcc = props.results.map(r => { const f = r.phases.find(p => p.phase === 'backward'); return f ? f.accuracy : 0 })
  const randomAcc = props.results.map(r => { const f = r.phases.find(p => p.phase === 'random'); return f ? f.accuracy : 0 })

  new Chart(chartCanvas.value, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Forward', data: forwardAcc, backgroundColor: 'rgba(34,197,94,0.6)' },
      { label: 'Backward', data: backwardAcc, backgroundColor: 'rgba(59,130,246,0.6)' },
      { label: 'Random', data: randomAcc, backgroundColor: 'rgba(168,85,247,0.6)' },
    ] },
    options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Accuracy (%) by Resolution' } }, scales: { y: { min: 0, max: 100 } } },
  })

  const seekMsData = props.results.map(r => { const f = r.phases.find(p => p.phase === 'forward'); return f ? f.avgSeekMs : 0 })

  new Chart(chartCanvas2.value, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Avg seek ms', data: seekMsData, backgroundColor: 'rgba(234,179,8,0.6)' }] },
    options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Avg Seek Time (ms)' } } },
  })
}

watchEffect(() => {
  if (activeTab.value === 'charts' && !chartsDrawn.value) {
    nextTick(drawCharts)
    chartsDrawn.value = true
  }
})

const profileCards = computed(() => {
  const p = props.browserProfile
  return [
    { label: 'Browser', value: `${p.browserName} ${p.browserVersion}` },
    { label: 'OS', value: p.os },
    { label: 'GPU', value: p.gpu },
    { label: 'GPU Vendor', value: p.gpuVendor },
    { label: 'Cores', value: String(p.cores) },
    { label: 'Memory', value: p.memoryGB > 0 ? `${p.memoryGB} GB` : 'N/A' },
    { label: 'Screen', value: p.screen },
    { label: 'JS Heap', value: p.jsHeapUsedMB > 0 ? `${p.jsHeapUsedMB} MB` : 'N/A' },
    { label: 'Timing Res', value: p.timingResolutionNs > 0 ? `${p.timingResolutionNs} ns` : 'N/A' },
    { label: 'Codecs', value: p.codecs.join(', ') || 'N/A' },
  ]
})
</script>

<template>
  <div class="space-y-5">
    <div class="text-center">
      <h1 class="text-xl font-semibold tracking-tight">Results</h1>
      <p class="text-sm text-muted-foreground mt-1">
        {{ results.length }} видео × 3 фазы = {{ results.length * 3 }} строк
      </p>
    </div>

    <div class="flex gap-1 border-b">
      <button
        v-for="t in TABS" :key="t"
        class="px-4 py-2 text-sm capitalize transition"
        :class="activeTab === t ? 'border-b-2 border-accent text-accent' : 'text-muted-foreground hover:text-foreground'"
        @click="activeTab = t; chartsDrawn = false"
      >
        {{ t }}
      </button>
    </div>

    <div v-if="activeTab === 'table'" class="space-y-3">
      <div class="rounded-lg border overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-3 py-2.5 text-left cursor-pointer select-none" @click="setSort('filename')">Файл ↕</th>
              <th class="px-3 py-2.5 text-left cursor-pointer select-none" @click="setSort('phase')">Фаза ↕</th>
              <th class="px-3 py-2.5 text-right cursor-pointer select-none" @click="setSort('accuracy')">Точность ↕</th>
              <th class="px-3 py-2.5 text-right">Матчи</th>
              <th class="px-3 py-2.5 text-right">±1</th>
              <th class="px-3 py-2.5 text-right cursor-pointer select-none" @click="setSort('avgSeekMs')">Seek (ms) ↕</th>
              <th class="px-3 py-2.5 text-right">FPS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in flatRows" :key="row.id" class="border-t hover:bg-muted/20 transition">
              <td class="px-3 py-2 font-mono text-xs">{{ row.filename }}</td>
              <td class="px-3 py-2 capitalize text-muted-foreground">{{ row.phase }}</td>
              <td class="px-3 py-2 text-right">
                <span class="inline-block px-2 py-0.5 rounded text-xs font-mono" :class="accuracyColor(row.accuracy)">
                  {{ fmt(row.accuracy, 1) }}%
                </span>
              </td>
              <td class="px-3 py-2 text-right font-mono tabular-nums">{{ row.matches }}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums text-yellow-400">{{ row.offByOne }}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums">{{ fmt(row.avgSeekMs, 1) }}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums">{{ fmt(row.processingFps, 1) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="activeTab === 'charts'" class="space-y-8">
      <div class="rounded-lg border p-4">
        <canvas ref="chartCanvas"></canvas>
      </div>
      <div class="rounded-lg border p-4">
        <canvas ref="chartCanvas2"></canvas>
      </div>
    </div>

    <div v-if="activeTab === 'profile'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div v-for="card in profileCards" :key="card.label" class="rounded-lg border p-4 space-y-1">
        <div class="text-xs text-muted-foreground">{{ card.label }}</div>
        <div class="text-sm font-mono font-semibold break-all">{{ card.value }}</div>
      </div>
    </div>

    <div v-if="activeTab === 'export'" class="space-y-4">
      <div class="rounded-lg border p-6 text-center space-y-4">
        <p class="text-sm text-muted-foreground">Экспорт результатов тестирования</p>
        <div class="flex gap-4 justify-center">
          <Button @click="doExportAggregated">CSV (aggregated)</Button>
          <Button variant="outline" @click="doExportRaw">CSV (raw)</Button>
        </div>
        <p class="text-xs text-muted-foreground">Aggregated: 1 строка на видео-фазу | Raw: 1 строка на каждый кадр</p>
      </div>
    </div>

    <div class="pt-4 border-t">
      <Button variant="outline" @click="$emit('back')">← Новый запуск</Button>
    </div>
  </div>
</template>