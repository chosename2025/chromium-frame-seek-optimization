<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { Chart, ScatterController, LinearScale, PointElement, Tooltip } from 'chart.js'
import type { SeekMeasurement } from '@/entities/benchmark-result/model/types'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

Chart.register(ScatterController, LinearScale, PointElement, Tooltip)

const props = defineProps<{
  current: number
  total: number
  currentVideo: string
  liveSeeks: SeekMeasurement[]
  tabVisibilityWarning: boolean
  language: 'en' | 'ru'
}>()

const emit = defineEmits<{
  stop: []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const progressPercent = computed(() =>
  props.total > 0 ? Math.round((props.current / props.total) * 100) : 0,
)

const isRu = computed(() => props.language === 'ru')

const warningText = computed(() =>
  isRu.value
    ? 'Во время теста вкладка теряла фокус. Результаты могут быть искажены.'
    : 'Tab visibility change detected during benchmark. Results may be affected.',
)

const seeksRecordedText = computed(() =>
  isRu.value ? 'измерений' : 'seeks recorded',
)

const stopText = computed(() => (isRu.value ? 'Остановить тест' : 'Stop benchmark'))

function initChart(): void {
  if (!canvasRef.value) return
  chart = new Chart(canvasRef.value, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Seek time (ms)',
          data: [],
          backgroundColor: 'hsl(var(--primary) / 0.6)',
          pointRadius: 2,
        },
      ],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `seek #${ctx.parsed.x}: ${ctx.parsed.y?.toFixed(1) ?? 0}ms`,
          },
        },
      },
      scales: {
        x: { title: { display: true, text: 'Seek index' } },
        y: { title: { display: true, text: 'Time (ms)' }, min: 0 },
      },
    },
  })
}

watch(
  () => props.liveSeeks.length,
  () => {
    if (!chart) return
    chart.data.datasets[0].data = props.liveSeeks.map((s) => ({ x: s.seekIndex, y: s.seekTimeMs }))
    chart.update('none')
  },
)

onMounted(() => {
  initChart()
})

onUnmounted(() => {
  chart?.destroy()
})
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="tabVisibilityWarning"
      class="px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-sm text-yellow-700 dark:text-yellow-300"
    >
      {{ warningText }}
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground truncate max-w-md">{{ currentVideo }}</span>
        <span class="font-mono font-medium">{{ current }} / {{ total }}</span>
      </div>
      <Progress :model-value="progressPercent" class="h-2" />
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>{{ liveSeeks.length }} {{ seeksRecordedText }}</span>
        <span>{{ progressPercent }}%</span>
      </div>
    </div>

    <div class="relative h-48 border rounded-lg overflow-hidden bg-card">
      <canvas ref="canvasRef" class="w-full h-full" />
    </div>

    <div class="flex justify-end">
      <Button variant="destructive" size="sm" @click="emit('stop')">
        {{ stopText }}
      </Button>
    </div>
  </div>
</template>
