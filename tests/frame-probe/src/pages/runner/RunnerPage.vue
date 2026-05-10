<script setup lang="ts">
import { ref } from 'vue'
import { useRunnerStore } from '@/store'

import VideoSelector from '@/widgets/video-selector/VideoSelector.vue'
import RunnerProgress from '@/widgets/runner-progress/RunnerProgress.vue'
import ResultsDashboard from '@/widgets/results-dashboard/ResultsDashboard.vue'
import { runTests } from '@/features/run-tests/model/useRunner'
import { collectBrowserProfile } from '@/features/run-tests/model/collectBrowserProfile'
import type { VideoManifestItem } from '@/entities/test-result/types'

const store = useRunnerStore()

const state = ref({
  currentVideo: null as VideoManifestItem | null,
  videoIndex: 0,
  totalVideos: 0,
  phase: '',
  phaseFrameIndex: 0,
  phaseTotalFrames: 0,
  phaseProgress: 0,
  totalProgress: 0,
  totalElapsed: 0,
})

const isStopped = ref(false)

async function startRun(videos: VideoManifestItem[]) {
  store.selectVideos(videos)
  store.setRunning(true)
  isStopped.value = false

  const profile = await collectBrowserProfile()
  store.setBrowserProfile(profile)

  const results = await runTests(videos, profile, {
    onStateUpdate: (s) => { Object.assign(state.value, s) },
  })

  if (!store.isStopped) {
    store.setResults(results)
  }
  store.setRunning(false)
}

function handleStop() {
  isStopped.value = true
  store.stop()
}

function handleBack() {
  store.reset()
  state.value = { currentVideo: null, videoIndex: 0, totalVideos: 0, phase: '', phaseFrameIndex: 0, phaseTotalFrames: 0, phaseProgress: 0, totalProgress: 0, totalElapsed: 0 }
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground p-6">
    <div class="max-w-5xl mx-auto">

      <!-- Select -->
      <template v-if="store.step === 'select'">
        <VideoSelector @run="startRun" />
      </template>

      <!-- Running -->
      <template v-if="store.step === 'run'">
        <div class="text-center mb-4">
          <h2 class="text-lg font-semibold">Тест в процессе…</h2>
        </div>
        <div class="rounded-lg border p-6">
          <RunnerProgress
            :current-video="state.currentVideo"
            :video-index="state.videoIndex"
            :total-videos="state.totalVideos"
            :phase="state.phase"
            :phase-frame-index="state.phaseFrameIndex"
            :phase-total-frames="state.phaseTotalFrames"
            :phase-progress="state.phaseProgress"
            :total-progress="state.totalProgress"
            :total-elapsed="state.totalElapsed"
            :can-stop="!isStopped"
            @stop="handleStop"
          />
        </div>
      </template>

      <!-- Results -->
      <template v-if="store.step === 'results' && store.results.length">
        <ResultsDashboard
          :results="store.results"
          :browser-profile="store.browserProfile!"
          @back="handleBack"
        />
      </template>

    </div>
  </div>
</template>