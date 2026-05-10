<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { videoManifest } from '@/entities/video/videoManifest'
import type { VideoManifestItem } from '@/entities/test-result/types'

const emit = defineEmits<{ run: [videos: VideoManifestItem[]] }>()

const selected = ref<Set<string>>(new Set())
const filterCodec = ref<'all' | 'H.264' | 'VP9'>('all')
const filterRes = ref<'all' | 'small' | 'large'>('all')

const presets: { label: string; ids: string[] }[] = [
  { label: 'All', ids: videoManifest.map(v => v.filename) },
  { label: '4×4 + 8×8', ids: videoManifest.filter(v => v.width <= 8).map(v => v.filename) },
  { label: '16×16', ids: videoManifest.filter(v => v.width === 16).map(v => v.filename) },
  { label: '32×32+', ids: videoManifest.filter(v => v.width >= 32).map(v => v.filename) },
  { label: 'H.264 only', ids: videoManifest.filter(v => v.codec === 'H.264').map(v => v.filename) },
  { label: 'VP9 only', ids: videoManifest.filter(v => v.codec === 'VP9').map(v => v.filename) },
]

const filtered = computed(() => {
  return videoManifest.filter(v => {
    if (filterCodec.value !== 'all' && v.codec !== filterCodec.value) return false
    if (filterRes.value === 'small' && v.width > 16) return false
    if (filterRes.value === 'large' && v.width < 32) return false
    return true
  })
})

function toggle(name: string) {
  if (selected.value.has(name)) selected.value.delete(name)
  else selected.value.add(name)
}

function applyPreset(ids: string[]) {
  selected.value = new Set(ids)
}

function fmtDur(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`
  return `${(s / 60).toFixed(1)}m`
}

function go() {
  const videos = videoManifest.filter(v => selected.value.has(v.filename))
  emit('run', videos)
}
</script>

<template>
  <div class="space-y-5">
    <div class="text-center">
      <h1 class="text-xl font-semibold tracking-tight">Frame Probe — Pixel Seek Accuracy Test</h1>
      <p class="text-sm text-muted-foreground mt-1">Выберите видео для тестирования</p>
    </div>

    <!-- Presets -->
    <div class="flex gap-2 flex-wrap">
      <Button
        v-for="p in presets"
        :key="p.label"
        variant="outline"
        size="sm"
        @click="applyPreset(p.ids)"
      >
        {{ p.label }}
      </Button>
    </div>

    <!-- Filters -->
    <div class="flex gap-3 text-sm">
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground">Кодек:</span>
        <select v-model="filterCodec" class="rounded border bg-background px-2 py-1 text-xs">
          <option value="all">Все</option>
          <option value="H.264">H.264</option>
          <option value="VP9">VP9</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground">Размер:</span>
        <select v-model="filterRes" class="rounded border bg-background px-2 py-1 text-xs">
          <option value="all">Все</option>
          <option value="small">≤16px</option>
          <option value="large">≥32px</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-lg border overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-muted/50">
          <tr>
            <th class="px-3 py-2.5 text-left w-8"></th>
            <th class="px-3 py-2.5 text-left">Файл</th>
            <th class="px-3 py-2.5 text-left">Разр.</th>
            <th class="px-3 py-2.5 text-left">FPS</th>
            <th class="px-3 py-2.5 text-left">Кодек</th>
            <th class="px-3 py-2.5 text-left">Кадры</th>
            <th class="px-3 py-2.5 text-left">Длит.</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="v in filtered"
            :key="v.filename"
            class="border-t cursor-pointer hover:bg-muted/30 transition"
            :class="selected.has(v.filename) ? 'bg-accent/5' : ''"
            @click="toggle(v.filename)"
          >
            <td class="px-3 py-2">
              <input
                type="checkbox"
                :checked="selected.has(v.filename)"
                @click.stop
                @change="toggle(v.filename)"
                class="accent-accent w-4 h-4"
              />
            </td>
            <td class="px-3 py-2 font-mono text-xs">{{ v.filename }}</td>
            <td class="px-3 py-2 font-mono">{{ v.width }}×{{ v.height }}</td>
            <td class="px-3 py-2 font-mono">{{ v.fps }}</td>
            <td class="px-3 py-2">
              <Badge :variant="v.codec === 'H.264' ? 'default' : 'secondary'" class="text-xs">
                {{ v.codec }}
              </Badge>
            </td>
            <td class="px-3 py-2 font-mono tabular-nums">{{ v.totalFrames.toLocaleString() }}</td>
            <td class="px-3 py-2 font-mono text-muted-foreground tabular-nums">{{ fmtDur(v.durationSec) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">
        Выбрано: <span class="font-mono font-semibold text-foreground">{{ selected.size }}</span> / {{ videoManifest.length }}
      </p>
      <Button :disabled="selected.size === 0" @click="go">
        <span v-if="selected.size > 0">Запустить тест ({{ selected.size }} видео)</span>
        <span v-else>Выберите хотя бы одно видео</span>
      </Button>
    </div>
  </div>
</template>