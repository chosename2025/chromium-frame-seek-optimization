import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { VideoMeta } from '@/entities/video/model/types'
import type { BenchmarkResult, SeekMeasurement } from '@/entities/benchmark-result/model/types'
import type { BrowserProfile } from '@/entities/browser-profile/model/types'

export const useBenchmarkStore = defineStore('benchmark', () => {
  const selectedVideos = ref<VideoMeta[]>([])
  const results = ref<BenchmarkResult[]>([])
  const liveSeeks = ref<SeekMeasurement[]>([])
  const isRunning = ref(false)
  const progress = ref({ current: 0, total: 0, currentVideo: '' })
  const browserProfile = ref<BrowserProfile | null>(null)
  const tabVisibilityWarning = ref(false)
  const language = ref<'en' | 'ru'>('en')

  function setSelectedVideos(videos: VideoMeta[]): void {
    selectedVideos.value = videos
  }

  function setResults(newResults: BenchmarkResult[]): void {
    results.value = newResults
  }

  function setLiveSeeks(seeks: SeekMeasurement[]): void {
    liveSeeks.value = seeks
  }

  function setIsRunning(running: boolean): void {
    isRunning.value = running
  }

  function setProgress(p: { current: number; total: number; currentVideo: string }): void {
    progress.value = p
  }

  function setBrowserProfile(profile: BrowserProfile): void {
    browserProfile.value = profile
  }

  function setTabVisibilityWarning(warned: boolean): void {
    tabVisibilityWarning.value = warned
  }

  function setLanguage(nextLanguage: 'en' | 'ru'): void {
    language.value = nextLanguage
  }

  function loadSnapshot(newResults: BenchmarkResult[], newProfile: BrowserProfile): void {
    results.value = newResults
    browserProfile.value = newProfile
  }

  return {
    selectedVideos,
    results,
    liveSeeks,
    isRunning,
    progress,
    browserProfile,
    tabVisibilityWarning,
    language,
    setSelectedVideos,
    setResults,
    setLiveSeeks,
    setIsRunning,
    setProgress,
    setBrowserProfile,
    setTabVisibilityWarning,
    setLanguage,
    loadSnapshot,
  }
})
