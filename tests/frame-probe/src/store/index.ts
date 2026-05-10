import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TestResult, BrowserProfile, VideoManifestItem } from '@/entities/test-result/types'

export type RunnerStep = 'select' | 'run' | 'results'

export const useRunnerStore = defineStore('runner', () => {
  const step = ref<RunnerStep>('select')
  const selectedVideos = ref<VideoManifestItem[]>([])
  const results = ref<TestResult[]>([])
  const browserProfile = ref<BrowserProfile | null>(null)
  const isRunning = ref(false)
  const isStopped = ref(false)

  function selectVideos(videos: VideoManifestItem[]) {
    selectedVideos.value = videos
  }

  function setResults(r: TestResult[]) {
    results.value = r
    step.value = 'results'
  }

  function setBrowserProfile(p: BrowserProfile) {
    browserProfile.value = p
  }

  function setRunning(v: boolean) {
    isRunning.value = v
    if (v) {
      step.value = 'run'
      isStopped.value = false
    }
  }

  function stop() {
    isStopped.value = true
    isRunning.value = false
  }

  function reset() {
    step.value = 'select'
    results.value = []
    isRunning.value = false
    isStopped.value = false
  }

  return {
    step,
    selectedVideos,
    results,
    browserProfile,
    isRunning,
    isStopped,
    selectVideos,
    setResults,
    setBrowserProfile,
    setRunning,
    stop,
    reset,
  }
})