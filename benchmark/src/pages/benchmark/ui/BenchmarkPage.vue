<script setup lang="ts">
import { onMounted, computed, watch, ref, defineAsyncComponent } from 'vue'
import { useBenchmarkStore } from '@/app/store/index'
import { useBenchmark } from '@/features/run-benchmark/model/useBenchmark'
import { useBrowserProfile } from '@/features/collect-browser-profile/model/useBrowserProfile'
import { useExport } from '@/features/export-results/model/useExport'
import VideoSelector from '@/widgets/video-selector/ui/VideoSelector.vue'
import BenchmarkProgress from '@/widgets/benchmark-progress/ui/BenchmarkProgress.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { VideoMeta } from '@/entities/video/model/types'

const store = useBenchmarkStore()
const benchmark = useBenchmark()
const { collect } = useBrowserProfile()
const { loadBenchmark } = useExport()

const ResultsDashboard = defineAsyncComponent(
  () => import('@/widgets/results-dashboard/ui/ResultsDashboard.vue'),
)

const step = ref<'select' | 'run' | 'results'>('select')

onMounted(async () => {
  const profile = await collect()
  store.setBrowserProfile(profile)
})

watch(
  () => benchmark.results.value,
  (newResults) => {
    store.setResults([...newResults])
  },
  { deep: true },
)

watch(
  () => benchmark.liveSeeks.value,
  (seeks) => {
    store.setLiveSeeks([...seeks])
    if (seeks.some((s) => s.tabVisibilityInterrupted)) {
      store.setTabVisibilityWarning(true)
    }
  },
  { deep: true },
)

watch(
  () => benchmark.isRunning.value,
  (running) => store.setIsRunning(running),
)

watch(
  () => benchmark.progress.value,
  (p) => store.setProgress({ ...p }),
  { deep: true },
)

function onVideosSelected(videos: VideoMeta[]): void {
  store.setSelectedVideos(videos)
}

async function startBenchmark(): Promise<void> {
  step.value = 'run'
  store.setTabVisibilityWarning(false)
  store.setResults([])
  store.setLiveSeeks([])
  await benchmark.run(store.selectedVideos)
}

function stopBenchmark(): void {
  benchmark.stop()
}

watch(
  () => store.isRunning,
  (running) => {
    if (!running && store.results.length > 0) {
      step.value = 'results'
    }
  },
)

const headerTitle = 'Browser Video Seeking Benchmark'
const headerSubtitle =
  'Exhaustive frame-by-frame seek performance across resolutions, fps, and iframe densities'

const selectionTitle = 'Video selection'
const selectedVideosLabel = computed(() =>
  `${store.selectedVideos.length} videos selected`,
)
const runButtonLabel = 'Run benchmark'
const runningTitle = 'Running'
const resultsTitle = 'Results'
const combinationsLabel = computed(() =>
  `${store.results.length} combinations`,
)

const articleLabel = 'Original article'

const previewTitle = 'Frame-by-frame seek preview'

const currentVideoForPreview = computed(() => {
  const currentFilename = store.progress.currentVideo
  return store.selectedVideos.find((v) => v.filename === currentFilename) ?? null
})

const previewContainer = ref<HTMLDivElement | null>(null)

watch(
  () => benchmark.currentVideoEl.value,
  (videoEl) => {
    if (!previewContainer.value) return
    previewContainer.value.innerHTML = ''
    if (videoEl) {
      videoEl.style.width = '100%'
      videoEl.style.height = '100%'
      videoEl.style.objectFit = 'contain'
      previewContainer.value.appendChild(videoEl)
    }
  },
)

const fileInputRef = ref<HTMLInputElement | null>(null)

async function handleFileUpload(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  try {
    const snapshot = await loadBenchmark(file)
    store.loadSnapshot(snapshot.results, snapshot.profile)
    step.value = 'results'
  } catch {
    alert('Failed to load file')
  }
  target.value = ''
}

function triggerFileUpload(): void {
  fileInputRef.value?.click()
}

const loadFileLabel = 'Load .vsbench'
const backToSelectionLabel = 'Back to selection'

function backToSelection(): void {
  step.value = 'select'
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <div class="border-b">
      <div class="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">{{ headerTitle }}</h1>
          <p class="text-sm text-muted-foreground mt-0.5">
            {{ headerSubtitle }}
          </p>
          <a
            href="https://stepancar.github.io/articles/articles/html-video-element-seeking/"
            target="_blank"
            rel="noreferrer"
            class="mt-1 inline-flex text-xs text-primary underline underline-offset-4"
          >
            {{ articleLabel }}
          </a>
        </div>
        <div class="flex items-center gap-3">
          <Badge v-if="store.browserProfile" variant="outline" class="font-mono text-xs">
            {{ store.browserProfile.browserName }} {{ store.browserProfile.browserVersion }}
          </Badge>
          <Badge v-if="store.browserProfile" variant="outline" class="font-mono text-xs">
            {{ store.browserProfile.os }}
          </Badge>
        </div>
      </div>
    </div>

    <div class="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
      <div v-if="step === 'select'" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-medium">{{ selectionTitle }}</h2>
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">{{ selectedVideosLabel }}</span>
            <Button variant="outline" @click="triggerFileUpload">
              {{ loadFileLabel }}
            </Button>
            <Button
              :disabled="store.selectedVideos.length === 0 || store.isRunning"
              @click="startBenchmark"
            >
              {{ runButtonLabel }}
            </Button>
          </div>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept=".vsbench"
          class="hidden"
          @change="handleFileUpload"
        />
        <VideoSelector @update:selected="onVideosSelected" />
      </div>

      <Separator />

      <div v-if="step === 'run'" class="space-y-4">
        <h2 class="text-base font-medium">{{ runningTitle }}</h2>
        <BenchmarkProgress
          :current="store.progress.current"
          :total="store.progress.total"
          :current-video="store.progress.currentVideo"
          :live-seeks="store.liveSeeks"
          :tab-visibility-warning="store.tabVisibilityWarning"
          @stop="stopBenchmark"
        />
        <div v-if="currentVideoForPreview" class="space-y-2">
          <h3 class="text-sm font-medium text-muted-foreground">
            {{ previewTitle }}
          </h3>
          <div class="max-w-2xl border rounded-lg overflow-hidden bg-card p-3 space-y-2">
            <div class="text-xs font-mono truncate text-muted-foreground">
              {{ currentVideoForPreview.filename }}
            </div>
            <div ref="previewContainer" class="aspect-video bg-black rounded-md overflow-hidden" />
          </div>
        </div>
      </div>

      <div v-if="step === 'results' && store.results.length > 0 && store.browserProfile" class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Button variant="outline" size="sm" @click="backToSelection">
              {{ backToSelectionLabel }}
            </Button>
            <h2 class="text-base font-medium">{{ resultsTitle }}</h2>
          </div>
          <Badge variant="secondary">{{ combinationsLabel }}</Badge>
        </div>
        <ResultsDashboard :results="store.results" :profile="store.browserProfile" />
      </div>
    </div>
  </div>
</template>
