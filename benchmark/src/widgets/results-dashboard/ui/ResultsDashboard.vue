<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import {
  Chart,
  BarController,
  ScatterController,
  LineController,
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { BenchmarkResult } from '@/entities/benchmark-result/model/types'
import type { BrowserProfile } from '@/entities/browser-profile/model/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useExport } from '@/features/export-results/model/useExport'

Chart.register(
  BarController,
  ScatterController,
  LineController,
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
)

const props = defineProps<{
  results: BenchmarkResult[]
  profile: BrowserProfile
  language: 'en' | 'ru'
}>()

const { exportCsv, exportBenchmark, lastExportTimestamp, lastExportSizeBytes, isExporting } = useExport()

type SortKey = 'video' | 'resolution' | 'fps' | 'hasAudio' | 'iframes' | 'pattern' | 'mean' | 'median' | 'p95' | 'p99' | 'seekFPS' | 'consistencyScore' | 'linearRegressionSlope' | 'r2' | 'stallCount'
const sortKey = ref<SortKey>('mean')
const sortAsc = ref(true)

function setSort(key: SortKey): void {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
}

const sortedResults = computed(() => {
  return [...props.results].sort((a, b) => {
    let av: string | number
    let bv: string | number
    switch (sortKey.value) {
      case 'video': av = a.video.filename; bv = b.video.filename; break
      case 'resolution': av = a.video.resolution; bv = b.video.resolution; break
      case 'fps': av = a.video.fps; bv = b.video.fps; break
      case 'hasAudio': av = a.video.hasAudio ? 1 : 0; bv = b.video.hasAudio ? 1 : 0; break
      case 'iframes': av = a.video.iframes; bv = b.video.iframes; break
      case 'pattern': av = a.pattern; bv = b.pattern; break
      case 'mean': av = a.stats.mean; bv = b.stats.mean; break
      case 'median': av = a.stats.median; bv = b.stats.median; break
      case 'p95': av = a.stats.p95; bv = b.stats.p95; break
      case 'p99': av = a.stats.p99; bv = b.stats.p99; break
      case 'seekFPS': av = a.stats.seekFPS; bv = b.stats.seekFPS; break
      case 'consistencyScore': av = a.stats.consistencyScore; bv = b.stats.consistencyScore; break
      case 'linearRegressionSlope': av = a.stats.linearRegressionSlope; bv = b.stats.linearRegressionSlope; break
      case 'r2': av = a.stats.r2; bv = b.stats.r2; break
      case 'stallCount': av = a.stats.stallCount; bv = b.stats.stallCount; break
      default: av = 0; bv = 0
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortAsc.value ? cmp : -cmp
  })
})

const isRu = computed(() => props.language === 'ru')

const tabLabels = computed(() =>
  isRu.value
    ? { table: 'Таблица', charts: 'Графики', browser: 'Браузер', export: 'Экспорт' }
    : { table: 'Table', charts: 'Charts', browser: 'Browser', export: 'Export' },
)

const exportTexts = computed(() =>
  isRu.value
    ? {
        title: 'Экспорт результатов',
        downloadCsv: 'Скачать CSV',
        downloadBenchmark: 'Скачать .vsbench',
        buildingBenchmark: 'Формирование файла...',
        lastExport: 'Последний экспорт',
        fileSize: 'Размер файла',
        benchmarkDescription:
          '.vsbench файл содержит все результаты, профиль браузера и может быть загружен обратно для анализа',
        estimatedSize: 'Оценочный размер',
        kb: 'КБ',
      }
    : {
        title: 'Export results',
        downloadCsv: 'Download CSV',
        downloadBenchmark: 'Download .vsbench',
        buildingBenchmark: 'Building file...',
        lastExport: 'Last export',
        fileSize: 'File size',
        benchmarkDescription:
          '.vsbench file contains all results, browser profile, and can be loaded back for analysis',
        estimatedSize: 'Estimated size',
        kb: 'KB',
      },
)

const chartTexts = computed(() =>
  isRu.value
    ? {
        meanSeekTime: 'Среднее время перемотки по разрешению и FPS',
        seekIndexVsTime: 'Индекс перемотки vs время (обнаружение O(n))',
        heatmap: 'Тепловая карта: разрешение x множитель I-кадров (медиана мс)',
        iframeVsSeekFps: 'Количество I-кадров vs скорость перемотки',
        audioComparison: 'Сравнение времени перемотки: с аудио vs без аудио',
        boxPlot: 'Распределение времени перемотки (аппроксимация box plot)',
        fps30: '30fps',
        fps60: '60fps',
        seekIndex: 'Индекс перемотки',
        seekTime: 'Время (мс)',
        iframeCount: 'Количество I-кадров',
        seekFps: 'Скорость перемотки (FPS)',
        withAudio: 'С аудио',
        noAudio: 'Без аудио',
        min: 'Мин',
        p25: 'P25',
        median: 'Медиана',
        p75: 'P75',
        max: 'Макс',
      }
    : {
        meanSeekTime: 'Mean seek time by resolution and FPS',
        seekIndexVsTime: 'Seek index vs seek time (O(n) detection)',
        heatmap: 'Resolution x I-frame multiplier heatmap (median ms)',
        iframeVsSeekFps: 'I-frame count vs seek FPS',
        audioComparison: 'Audio vs no-audio seek time comparison',
        boxPlot: 'Seek time distribution (box plot approximation)',
        fps30: '30fps',
        fps60: '60fps',
        seekIndex: 'Seek index',
        seekTime: 'Time (ms)',
        iframeCount: 'I-frame count',
        seekFps: 'Seek FPS',
        withAudio: 'With audio',
        noAudio: 'No audio',
        min: 'Min',
        p25: 'P25',
        median: 'Median',
        p75: 'P75',
        max: 'Max',
      },
)

function meanBadgeVariant(mean: number): 'default' | 'secondary' | 'destructive' {
  if (mean < 50) return 'default'
  if (mean < 150) return 'secondary'
  return 'destructive'
}

function formatMs(ms: number): string {
  return `${ms.toFixed(1)}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(2)} MB`
}

const barResolutionCanvasRef = ref<HTMLCanvasElement | null>(null)
const scatterCanvasRef = ref<HTMLCanvasElement | null>(null)
const iframeLineCanvasRef = ref<HTMLCanvasElement | null>(null)
const audioBarCanvasRef = ref<HTMLCanvasElement | null>(null)
const boxPlotCanvasRef = ref<HTMLCanvasElement | null>(null)

let barResolutionChart: Chart | null = null
let scatterChart: Chart | null = null
let iframeLineChart: Chart | null = null
let audioBarChart: Chart | null = null
let boxPlotChart: Chart | null = null

const CHART_COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(271, 81%, 56%)',
  'hsl(199, 89%, 48%)',
]

function buildBarResolutionChart(): void {
  if (!barResolutionCanvasRef.value) return
  barResolutionChart?.destroy()
  const sequentialResults = props.results.filter((r) => r.pattern === 'frame')
  const resolutions: string[] = ['480p', '720p', '1080p', '2160p']
  const fps30Data = resolutions.map((res) => {
    const r = sequentialResults.find((x) => x.video.resolution === res && x.video.fps === 30)
    return r ? r.stats.mean : 0
  })
  const fps60Data = resolutions.map((res) => {
    const r = sequentialResults.find((x) => x.video.resolution === res && x.video.fps === 60)
    return r ? r.stats.mean : 0
  })
  barResolutionChart = new Chart(barResolutionCanvasRef.value, {
    type: 'bar',
    data: {
      labels: resolutions,
      datasets: [
        { label: chartTexts.value.fps30, data: fps30Data, backgroundColor: CHART_COLORS[0] },
        { label: chartTexts.value.fps60, data: fps60Data, backgroundColor: CHART_COLORS[1] },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { title: { display: true, text: chartTexts.value.seekTime } },
      },
    },
  })
}

function buildScatterChart(): void {
  if (!scatterCanvasRef.value) return
  scatterChart?.destroy()
  const sequentialResults = props.results.filter((r) => r.pattern === 'frame').slice(0, 6)
  const datasets = sequentialResults.map((r, i) => ({
    label: r.video.filename.replace('bbb_sunflower_', '').replace('.mp4', ''),
    data: r.seeks.map((s) => ({ x: s.seekIndex, y: s.seekTimeMs })),
    backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '80',
    pointRadius: 2,
  }))
  scatterChart = new Chart(scatterCanvasRef.value, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { title: { display: true, text: chartTexts.value.seekIndex } },
        y: { title: { display: true, text: chartTexts.value.seekTime }, min: 0 },
      },
    },
  })
}

function buildIframeLineChart(): void {
  if (!iframeLineCanvasRef.value) return
  iframeLineChart?.destroy()
  const sequentialResults = props.results.filter((r) => r.pattern === 'frame' && r.video.durationSec === 60)
  const iframeGroups = new Map<number, number[]>()
  for (const r of sequentialResults) {
    const iframes = r.video.iframes
    if (!iframeGroups.has(iframes)) iframeGroups.set(iframes, [])
    iframeGroups.get(iframes)!.push(r.stats.seekFPS)
  }
  const sorted = [...iframeGroups.entries()].sort((a, b) => a[0] - b[0])
  iframeLineChart = new Chart(iframeLineCanvasRef.value, {
    type: 'line',
    data: {
      labels: sorted.map(([k]) => String(k)),
      datasets: [
        {
          label: chartTexts.value.seekFps,
          data: sorted.map(([, v]) => v.reduce((a, b) => a + b, 0) / v.length),
          borderColor: CHART_COLORS[2],
          backgroundColor: CHART_COLORS[2] + '40',
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: chartTexts.value.iframeCount } },
        y: { title: { display: true, text: chartTexts.value.seekFps } },
      },
    },
  })
}

function buildAudioBarChart(): void {
  if (!audioBarCanvasRef.value) return
  audioBarChart?.destroy()
  const sequentialResults = props.results.filter((r) => r.pattern === 'frame')
  const pairs: Array<{ label: string; withAudio: number; withoutAudio: number }> = []
  for (const r of sequentialResults.filter((r) => r.video.hasAudio)) {
    const noAudio = sequentialResults.find(
      (x) =>
        !x.video.hasAudio &&
        x.video.resolution === r.video.resolution &&
        x.video.fps === r.video.fps &&
        x.video.durationSec === r.video.durationSec,
    )
    if (noAudio) {
      pairs.push({
        label: `${r.video.resolution}/${r.video.fps}fps`,
        withAudio: r.stats.mean,
        withoutAudio: noAudio.stats.mean,
      })
    }
  }
  audioBarChart = new Chart(audioBarCanvasRef.value, {
    type: 'bar',
    data: {
      labels: pairs.map((p) => p.label),
      datasets: [
        { label: chartTexts.value.withAudio, data: pairs.map((p) => p.withAudio), backgroundColor: CHART_COLORS[3] },
        { label: chartTexts.value.noAudio, data: pairs.map((p) => p.withoutAudio), backgroundColor: CHART_COLORS[4] },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { title: { display: true, text: chartTexts.value.seekTime } },
      },
    },
  })
}

function buildBoxPlotChart(): void {
  if (!boxPlotCanvasRef.value) return
  boxPlotChart?.destroy()
  const sequentialResults = props.results.filter((r) => r.pattern === 'frame').slice(0, 8)
  const labels = sequentialResults.map((r) =>
    r.video.filename.replace('bbb_sunflower_', '').replace('.mp4', '').slice(0, 20),
  )
  const minData = sequentialResults.map((r) => r.stats.min)
  const p25Data = sequentialResults.map((r) => {
    const sorted = [...r.seeks.map((s) => s.seekTimeMs)].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * 0.25)]
  })
  const medianData = sequentialResults.map((r) => r.stats.median)
  const p75Data = sequentialResults.map((r) => {
    const sorted = [...r.seeks.map((s) => s.seekTimeMs)].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * 0.75)]
  })
  const maxData = sequentialResults.map((r) => r.stats.max)
  boxPlotChart = new Chart(boxPlotCanvasRef.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: chartTexts.value.min, data: minData, backgroundColor: CHART_COLORS[1] + 'aa' },
        { label: chartTexts.value.p25, data: p25Data, backgroundColor: CHART_COLORS[0] + 'aa' },
        { label: chartTexts.value.median, data: medianData, backgroundColor: CHART_COLORS[2] + 'aa' },
        { label: chartTexts.value.p75, data: p75Data, backgroundColor: CHART_COLORS[3] + 'aa' },
        { label: chartTexts.value.max, data: maxData, backgroundColor: CHART_COLORS[5] + 'aa' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { title: { display: true, text: chartTexts.value.seekTime } },
      },
    },
  })
}

const heatmapData = computed(() => {
  const resolutions = ['480p', '720p', '1080p', '2160p'] as const
  const iframeMultipliers = [1, 10, 20] as const
  const sequentialResults = props.results.filter((r) => r.pattern === 'frame')
  const allMeans = sequentialResults.map((r) => r.stats.median)
  const minMean = Math.min(...allMeans)
  const maxMean = Math.max(...allMeans)
  return resolutions.map((res) =>
    iframeMultipliers.map((mult) => {
      const r = sequentialResults.find(
        (x) => x.video.resolution === res && x.video.iframeMultiplier === mult,
      )
      if (!r) return { value: null, color: 'hsl(0,0%,20%)' }
      const normalized = maxMean > minMean ? (r.stats.median - minMean) / (maxMean - minMean) : 0
      const hue = Math.round(120 - normalized * 120)
      return { value: r.stats.median, color: `hsl(${hue}, 70%, 45%)` }
    }),
  )
})

const activeTab = ref('table')

watch(
  () => activeTab.value,
  (tab) => {
    if (tab !== 'charts') return
    setTimeout(() => {
      buildBarResolutionChart()
      buildScatterChart()
      buildIframeLineChart()
      buildAudioBarChart()
      buildBoxPlotChart()
    }, 50)
  },
)

onUnmounted(() => {
  barResolutionChart?.destroy()
  scatterChart?.destroy()
  iframeLineChart?.destroy()
  audioBarChart?.destroy()
  boxPlotChart?.destroy()
})
</script>

<template>
  <Tabs v-model="activeTab" class="w-full">
    <TabsList class="grid w-full grid-cols-4">
      <TabsTrigger value="table">{{ tabLabels.table }}</TabsTrigger>
      <TabsTrigger value="charts">{{ tabLabels.charts }}</TabsTrigger>
      <TabsTrigger value="browser">{{ tabLabels.browser }}</TabsTrigger>
      <TabsTrigger value="export">{{ tabLabels.export }}</TabsTrigger>
    </TabsList>

    <TabsContent value="table" class="mt-4">
      <div class="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                v-for="col in ([
                  { key: 'video', label: 'Video' },
                  { key: 'resolution', label: 'Res' },
                  { key: 'fps', label: 'FPS' },
                  { key: 'hasAudio', label: 'Audio' },
                  { key: 'iframes', label: 'I-frames' },
                  { key: 'pattern', label: 'Pattern' },
                  { key: 'mean', label: 'Mean (ms)' },
                  { key: 'median', label: 'Med (ms)' },
                  { key: 'p95', label: 'P95' },
                  { key: 'p99', label: 'P99' },
                  { key: 'seekFPS', label: 'Seek FPS' },
                  { key: 'consistencyScore', label: 'Consistency' },
                  { key: 'linearRegressionSlope', label: 'Slope' },
                  { key: 'r2', label: 'R2' },
                  { key: 'stallCount', label: 'Stalls' },
                ] as const)"
                :key="col.key"
                class="cursor-pointer hover:bg-accent select-none whitespace-nowrap"
                @click="setSort(col.key)"
              >
                {{ col.label }}
                <span v-if="sortKey === col.key" class="ml-1 text-xs">
                  {{ sortAsc ? '↑' : '↓' }}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="result in sortedResults" :key="`${result.video.filename}-${result.pattern}`">
              <TableCell class="font-mono text-xs max-w-xs truncate">
                {{ result.video.filename.replace('bbb_sunflower_', '').replace('.mp4', '') }}
              </TableCell>
              <TableCell>
                <Badge variant="outline" class="text-xs">{{ result.video.resolution }}</Badge>
              </TableCell>
              <TableCell class="text-sm">{{ result.video.fps }}</TableCell>
              <TableCell>
                <Badge :variant="result.video.hasAudio ? 'default' : 'secondary'" class="text-xs">
                  {{ result.video.hasAudio ? 'yes' : 'no' }}
                </Badge>
              </TableCell>
              <TableCell class="text-sm">{{ result.video.iframes }}</TableCell>
              <TableCell>
                <Badge variant="outline" class="text-xs">{{ result.pattern }}</Badge>
              </TableCell>
              <TableCell>
                <Badge :variant="meanBadgeVariant(result.stats.mean)" class="font-mono text-xs">
                  {{ formatMs(result.stats.mean) }}
                </Badge>
              </TableCell>
              <TableCell class="font-mono text-sm">{{ formatMs(result.stats.median) }}</TableCell>
              <TableCell class="font-mono text-sm">{{ formatMs(result.stats.p95) }}</TableCell>
              <TableCell class="font-mono text-sm">{{ formatMs(result.stats.p99) }}</TableCell>
              <TableCell class="font-mono text-sm">{{ result.stats.seekFPS.toFixed(1) }}</TableCell>
              <TableCell class="font-mono text-sm">{{ result.stats.consistencyScore.toFixed(1) }}</TableCell>
              <TableCell class="font-mono text-sm">{{ result.stats.linearRegressionSlope.toFixed(4) }}</TableCell>
              <TableCell class="font-mono text-sm">{{ result.stats.r2.toFixed(4) }}</TableCell>
              <TableCell>
                <Badge :variant="result.stats.stallCount > 0 ? 'destructive' : 'secondary'" class="text-xs">
                  {{ result.stats.stallCount }}
                </Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </TabsContent>

    <TabsContent value="charts" class="mt-4 space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle class="text-sm">{{ chartTexts.meanSeekTime }}</CardTitle></CardHeader>
          <CardContent class="h-56">
            <canvas ref="barResolutionCanvasRef" class="w-full h-full" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle class="text-sm">{{ chartTexts.seekIndexVsTime }}</CardTitle></CardHeader>
          <CardContent class="h-56">
            <canvas ref="scatterCanvasRef" class="w-full h-full" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle class="text-sm">{{ chartTexts.heatmap }}</CardTitle></CardHeader>
          <CardContent>
            <div class="space-y-1">
              <div class="flex gap-1 items-center">
                <span class="text-xs w-16 text-muted-foreground"></span>
                <span v-for="mult in [1, 10, 20]" :key="mult" class="text-xs w-24 text-center font-medium">x{{ mult }}</span>
              </div>
              <div
                v-for="(row, ri) in heatmapData"
                :key="ri"
                class="flex gap-1 items-center"
              >
                <span class="text-xs w-16 text-muted-foreground">{{ ['480p','720p','1080p','2160p'][ri] }}</span>
                <div
                  v-for="(cell, ci) in row"
                  :key="ci"
                  class="w-24 h-10 rounded flex items-center justify-center text-xs font-mono text-white font-medium"
                  :style="{ backgroundColor: cell.color }"
                >
                  {{ cell.value !== null ? `${cell.value.toFixed(0)}ms` : 'N/A' }}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle class="text-sm">{{ chartTexts.iframeVsSeekFps }}</CardTitle></CardHeader>
          <CardContent class="h-56">
            <canvas ref="iframeLineCanvasRef" class="w-full h-full" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle class="text-sm">{{ chartTexts.audioComparison }}</CardTitle></CardHeader>
          <CardContent class="h-56">
            <canvas ref="audioBarCanvasRef" class="w-full h-full" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle class="text-sm">{{ chartTexts.boxPlot }}</CardTitle></CardHeader>
          <CardContent class="h-56">
            <canvas ref="boxPlotCanvasRef" class="w-full h-full" />
          </CardContent>
        </Card>
      </div>
    </TabsContent>

    <TabsContent value="browser" class="mt-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle class="text-sm">Browser</CardTitle></CardHeader>
          <CardContent class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-muted-foreground">Name</span><span>{{ profile.browserName }}</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Version</span><span class="font-mono">{{ profile.browserVersion }}</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">OS</span><span>{{ profile.os }} {{ profile.osVersion }}</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">User agent</span><span class="font-mono text-xs truncate max-w-48" :title="profile.userAgent">{{ profile.userAgent.slice(0, 40) }}...</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle class="text-sm">Hardware</CardTitle></CardHeader>
          <CardContent class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-muted-foreground">CPU cores</span><span class="font-mono">{{ profile.hardwareConcurrency }}</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Device memory</span><span class="font-mono">{{ profile.deviceMemory }} GB</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Pixel ratio</span><span class="font-mono">{{ profile.devicePixelRatio }}</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Screen</span><span class="font-mono">{{ profile.screenResolution }}</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Color depth</span><span class="font-mono">{{ profile.colorDepth }}bit</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle class="text-sm">GPU</CardTitle></CardHeader>
          <CardContent class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-muted-foreground">Vendor</span><span class="text-right max-w-48 truncate" :title="profile.gpu.vendor">{{ profile.gpu.vendor }}</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Renderer</span><span class="text-right max-w-48 truncate" :title="profile.gpu.renderer">{{ profile.gpu.renderer }}</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">GL version</span><span class="font-mono text-xs">{{ profile.gpu.version }}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle class="text-sm">Memory and timing</CardTitle></CardHeader>
          <CardContent class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-muted-foreground">JS heap limit</span><span class="font-mono">{{ profile.jsHeapSizeLimitMB.toFixed(0) }} MB</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">JS heap used</span><span class="font-mono">{{ profile.usedJSHeapSizeMB.toFixed(0) }} MB</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Timer resolution</span><span class="font-mono">{{ profile.performanceTimingResolutionMs.toFixed(3) }}ms</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Connection</span><span class="font-mono">{{ profile.connectionEffectiveType }} / {{ profile.connectionDownlink }} Mbps</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle class="text-sm">Codec support</CardTitle></CardHeader>
          <CardContent class="space-y-1.5 text-xs">
            <div
              v-for="(support, codec) in profile.codecs"
              :key="codec"
              class="flex justify-between items-center"
            >
              <span class="font-mono text-muted-foreground truncate max-w-56" :title="String(codec)">{{ codec }}</span>
              <Badge
                :variant="support === 'probably' ? 'default' : support === 'maybe' ? 'secondary' : 'destructive'"
                class="text-xs ml-2 shrink-0"
              >
                {{ support || 'no' }}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle class="text-sm">Decoding capabilities</CardTitle></CardHeader>
          <CardContent class="space-y-2 text-xs">
            <div
              v-for="(cap, label) in profile.decodingCapabilities"
              :key="label"
              class="space-y-0.5"
            >
              <div class="font-medium text-muted-foreground">{{ label }}</div>
              <div class="flex gap-2 pl-2">
                <Badge :variant="cap.supported ? 'default' : 'destructive'" class="text-xs">{{ cap.supported ? 'supported' : 'unsupported' }}</Badge>
                <Badge :variant="cap.smooth ? 'default' : 'secondary'" class="text-xs">{{ cap.smooth ? 'smooth' : 'not smooth' }}</Badge>
                <Badge :variant="cap.powerEfficient ? 'default' : 'secondary'" class="text-xs">{{ cap.powerEfficient ? 'efficient' : 'not efficient' }}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>

    <TabsContent value="export" class="mt-4">
      <Card>
        <CardHeader><CardTitle>{{ exportTexts.title }}</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <div class="flex gap-3">
            <Button @click="exportCsv(results, profile)">
              {{ exportTexts.downloadCsv }}
            </Button>
            <Button variant="outline" :disabled="isExporting" @click="exportBenchmark(results, profile)">
              {{ isExporting ? exportTexts.buildingBenchmark : exportTexts.downloadBenchmark }}
            </Button>
          </div>
          <div v-if="lastExportTimestamp" class="text-sm text-muted-foreground space-y-1">
            <div>{{ exportTexts.lastExport }}: {{ lastExportTimestamp }}</div>
            <div>{{ exportTexts.fileSize }}: {{ formatBytes(lastExportSizeBytes) }}</div>
          </div>
          <div class="text-sm text-muted-foreground">
            <div>{{ exportTexts.benchmarkDescription }}</div>
            <div class="mt-1">
              {{ exportTexts.estimatedSize }}:
              ~{{ Math.round(results.reduce((s, r) => s + r.seeks.length, 0) * 0.3) }} {{ exportTexts.kb }}
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
</template>
