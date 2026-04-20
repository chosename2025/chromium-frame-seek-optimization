<script setup lang="ts">
import { ref, computed } from 'vue'
import type { VideoMeta, Resolution, Fps, IframeMultiplier } from '@/entities/video/model/types'
import { VIDEO_MANIFEST } from '@/entities/video/model/videoManifest'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import AppCheckbox from '@/shared/ui/AppCheckbox.vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const props = defineProps<{
  language: 'en' | 'ru'
}>()

const emit = defineEmits<{
  'update:selected': [videos: VideoMeta[]]
}>()

const selectedFilenames = ref<Set<string>>(new Set())
const filterResolutions = ref<Set<Resolution>>(new Set())
const filterFps = ref<Set<Fps>>(new Set())
const filterAudio = ref<'all' | 'yes' | 'no'>('all')
const filterDuration = ref<'all' | '7' | '60'>('all')
const filterIframeMultiplier = ref<IframeMultiplier | 'all'>('all')

const QUICK_PRESET_FILENAMES = [
  'bbb_sunflower_1min_480p_30fps_normal.mp4',
  'bbb_sunflower_1min_1080p_30fps_normal.mp4',
  'bbb_sunflower_1min_1080p_30fps_normal_10_times_more_iframes.mp4',
  'bbb_sunflower_7sec_1080p_30fps_one_iframe.mp4',
  'bbb_sunflower_1min_2160p_60fps_normal.mp4',
]

const STANDARD_PRESET_FILENAMES = [
  'bbb_sunflower_1min_480p_30fps_normal.mp4',
  'bbb_sunflower_1min_480p_30fps_normal_10_times_more_iframes.mp4',
  'bbb_sunflower_1min_480p_30fps_normal_noaudio.mp4',
  'bbb_sunflower_1min_480p_60fps_normal.mp4',
  'bbb_sunflower_1min_720p_30fps_normal.mp4',
  'bbb_sunflower_1min_720p_30fps_normal_10_times_more_iframes.mp4',
  'bbb_sunflower_1min_1080p_30fps_normal.mp4',
  'bbb_sunflower_1min_1080p_30fps_normal_10_times_more_iframes.mp4',
  'bbb_sunflower_1min_1080p_30fps_normal_20_times_more_iframes.mp4',
  'bbb_sunflower_1min_1080p_30fps_normal_noaudio.mp4',
  'bbb_sunflower_1min_1080p_60fps_normal.mp4',
  'bbb_sunflower_1min_2160p_30fps_normal.mp4',
  'bbb_sunflower_1min_2160p_60fps_normal.mp4',
  'bbb_sunflower_7sec_1080p_30fps_normal.mp4',
  'bbb_sunflower_7sec_1080p_30fps_one_iframe.mp4',
]

const resolutionOptions: Resolution[] = ['480p', '720p', '1080p', '2160p']
const fpsOptions: Fps[] = [30, 60]
const iframeOptions: Array<IframeMultiplier | 'all'> = ['all', 1, 10, 20, 'all', 'one']

const isRu = computed(() => props.language === 'ru')

const labels = computed(() =>
  isRu.value
    ? {
        preset: 'Профиль:',
        quick: 'Быстрый (5)',
        standard: 'Стандартный (15)',
        full: 'Полный (30)',
        selected: 'выбрано',
        resolution: 'Разрешение:',
        fps: 'Кадровая частота:',
        audio: 'Аудио:',
        duration: 'Длительность:',
        iframes: 'I-кадры:',
        all: 'все',
        yes: 'есть',
        no: 'нет',
        filename: 'Файл',
        res: 'Разр.',
        fpsCol: 'FPS',
        audioCol: 'Аудио',
        size: 'Размер',
        iframesCol: 'I-кадры',
        pframesCol: 'P-кадры',
        bframesCol: 'B-кадры',
        durationCol: 'Длительность',
      }
    : {
        preset: 'Preset:',
        quick: 'Quick (5)',
        standard: 'Standard (15)',
        full: 'Full (30)',
        selected: 'selected',
        resolution: 'Resolution:',
        fps: 'FPS:',
        audio: 'Audio:',
        duration: 'Duration:',
        iframes: 'I-frames:',
        all: 'all',
        yes: 'yes',
        no: 'no',
        filename: 'Filename',
        res: 'Res',
        fpsCol: 'FPS',
        audioCol: 'Audio',
        size: 'Size',
        iframesCol: 'I-frames',
        pframesCol: 'P-frames',
        bframesCol: 'B-frames',
        durationCol: 'Duration',
      },
)

const filteredVideos = computed(() => {
  return VIDEO_MANIFEST.filter((v) => {
    if (filterResolutions.value.size > 0 && !filterResolutions.value.has(v.resolution)) return false
    if (filterFps.value.size > 0 && !filterFps.value.has(v.fps)) return false
    if (filterAudio.value === 'yes' && !v.hasAudio) return false
    if (filterAudio.value === 'no' && v.hasAudio) return false
    if (filterDuration.value !== 'all' && v.durationSec !== Number(filterDuration.value)) return false
    if (filterIframeMultiplier.value !== 'all' && v.iframeMultiplier !== filterIframeMultiplier.value) return false
    return true
  })
})

const selectedVideos = computed(() =>
  VIDEO_MANIFEST.filter((v) => selectedFilenames.value.has(v.filename)),
)

function toggleVideo(filename: string): void {
  if (selectedFilenames.value.has(filename)) {
    selectedFilenames.value.delete(filename)
  } else {
    selectedFilenames.value.add(filename)
  }
  emit('update:selected', selectedVideos.value)
}

function toggleResolution(res: Resolution): void {
  if (filterResolutions.value.has(res)) {
    filterResolutions.value.delete(res)
  } else {
    filterResolutions.value.add(res)
  }
}

function toggleFps(fps: Fps): void {
  if (filterFps.value.has(fps)) {
    filterFps.value.delete(fps)
  } else {
    filterFps.value.add(fps)
  }
}

function applyPreset(filenames: string[]): void {
  selectedFilenames.value = new Set(filenames)
  emit('update:selected', selectedVideos.value)
}

function applyFullPreset(): void {
  selectedFilenames.value = new Set(VIDEO_MANIFEST.map((v) => v.filename))
  emit('update:selected', selectedVideos.value)
}

function toggleSelectAll(): void {
  if (filteredVideos.value.every((v) => selectedFilenames.value.has(v.filename))) {
    filteredVideos.value.forEach((v) => selectedFilenames.value.delete(v.filename))
  } else {
    filteredVideos.value.forEach((v) => selectedFilenames.value.add(v.filename))
  }
  emit('update:selected', selectedVideos.value)
}

const allFilteredSelected = computed(() =>
  filteredVideos.value.length > 0 &&
  filteredVideos.value.every((v) => selectedFilenames.value.has(v.filename)),
)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted-foreground">{{ labels.preset }}</span>
        <Button size="sm" variant="outline" @click="applyPreset(QUICK_PRESET_FILENAMES)">
          {{ labels.quick }}
        </Button>
        <Button size="sm" variant="outline" @click="applyPreset(STANDARD_PRESET_FILENAMES)">
          {{ labels.standard }}
        </Button>
        <Button size="sm" variant="outline" @click="applyFullPreset">
          {{ labels.full }}
        </Button>
      </div>
      <Badge variant="secondary">
        {{ selectedFilenames.size }} {{ labels.selected }}
      </Badge>
    </div>

    <div class="flex flex-wrap gap-3 p-3 bg-muted/50 rounded-lg">
      <div class="flex items-center gap-1.5">
        <span class="text-xs font-medium text-muted-foreground">{{ labels.resolution }}</span>
        <button
          v-for="res in resolutionOptions"
          :key="res"
          :class="[
            'px-2 py-0.5 text-xs rounded border transition-colors',
            filterResolutions.has(res)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border hover:bg-accent',
          ]"
          @click="toggleResolution(res)"
        >
          {{ res }}
        </button>
      </div>

      <div class="flex items-center gap-1.5">
        <span class="text-xs font-medium text-muted-foreground">{{ labels.fps }}</span>
        <button
          v-for="fps in fpsOptions"
          :key="fps"
          :class="[
            'px-2 py-0.5 text-xs rounded border transition-colors',
            filterFps.has(fps)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border hover:bg-accent',
          ]"
          @click="toggleFps(fps)"
        >
          {{ fps }}
        </button>
      </div>

      <div class="flex items-center gap-1.5">
        <span class="text-xs font-medium text-muted-foreground">{{ labels.audio }}</span>
        <button
          v-for="opt in (['all', 'yes', 'no'] as const)"
          :key="opt"
          :class="[
            'px-2 py-0.5 text-xs rounded border transition-colors',
            filterAudio === opt
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border hover:bg-accent',
          ]"
          @click="filterAudio = opt"
        >
          {{
            opt === 'all'
              ? labels.all
              : opt === 'yes'
                ? labels.yes
                : labels.no
          }}
        </button>
      </div>

      <div class="flex items-center gap-1.5">
        <span class="text-xs font-medium text-muted-foreground">{{ labels.duration }}</span>
        <button
          v-for="opt in (['all', '7', '60'] as const)"
          :key="opt"
          :class="[
            'px-2 py-0.5 text-xs rounded border transition-colors',
            filterDuration === opt
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border hover:bg-accent',
          ]"
          @click="filterDuration = opt"
        >
          {{ opt === 'all' ? labels.all : `${opt}s` }}
        </button>
      </div>

      <div class="flex items-center gap-1.5">
        <span class="text-xs font-medium text-muted-foreground">{{ labels.iframes }}</span>
        <select
          v-model="filterIframeMultiplier"
          class="text-xs border border-border rounded px-1.5 py-0.5 bg-background"
        >
          <option v-for="opt in iframeOptions" :key="String(opt)" :value="opt">{{ opt }}</option>
        </select>
      </div>
    </div>

    <div class="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-10">
              <AppCheckbox :checked="allFilteredSelected" @update:checked="toggleSelectAll" />
            </TableHead>
            <TableHead>{{ labels.filename }}</TableHead>
            <TableHead class="w-20">{{ labels.res }}</TableHead>
            <TableHead class="w-16">{{ labels.fpsCol }}</TableHead>
            <TableHead class="w-16">{{ labels.audioCol }}</TableHead>
            <TableHead class="w-20">{{ labels.size }}</TableHead>
            <TableHead class="w-20">{{ labels.iframesCol }}</TableHead>
            <TableHead class="w-20">{{ labels.pframesCol }}</TableHead>
            <TableHead class="w-20">{{ labels.bframesCol }}</TableHead>
            <TableHead class="w-20">{{ labels.durationCol }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="video in filteredVideos"
            :key="video.filename"
            :class="selectedFilenames.has(video.filename) ? 'bg-accent/30' : ''"
            class="cursor-pointer"
            @click="toggleVideo(video.filename)"
          >
            <TableCell @click.stop>
              <AppCheckbox
                :checked="selectedFilenames.has(video.filename)"
                @update:checked="toggleVideo(video.filename)"
              />
            </TableCell>
            <TableCell class="font-mono text-xs max-w-xs truncate">{{ video.filename }}</TableCell>
            <TableCell>
              <Badge variant="outline" class="text-xs">{{ video.resolution }}</Badge>
            </TableCell>
            <TableCell class="text-sm">{{ video.fps }}</TableCell>
            <TableCell>
              <Badge :variant="video.hasAudio ? 'default' : 'secondary'" class="text-xs">
                {{ video.hasAudio ? 'yes' : 'no' }}
              </Badge>
            </TableCell>
            <TableCell class="text-sm">{{ video.sizeMB }} MB</TableCell>
            <TableCell class="text-sm">{{ video.iframes }}</TableCell>
            <TableCell class="text-sm">{{ video.pframes }}</TableCell>
            <TableCell class="text-sm">{{ video.bframes }}</TableCell>
            <TableCell class="text-sm">{{ video.durationSec }}s</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
