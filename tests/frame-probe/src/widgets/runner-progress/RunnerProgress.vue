<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { VideoManifestItem } from '@/entities/test-result/types'

defineProps<{
  currentVideo: VideoManifestItem | null
  videoIndex: number
  totalVideos: number
  phase: string
  phaseFrameIndex: number
  phaseTotalFrames: number
  phaseProgress: number
  totalProgress: number
  totalElapsed: number
  canStop: boolean
}>()

defineEmits<{ stop: [] }>()

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}
</script>

<template>
  <div class="space-y-4 text-center py-8">
    <div v-if="currentVideo">
      <p class="text-sm text-muted-foreground mb-1">
        Видео {{ videoIndex + 1 }} из {{ totalVideos }}
      </p>
      <p class="font-mono font-semibold text-lg truncate max-w-md mx-auto">
        {{ currentVideo.filename }}
      </p>
    </div>

    <div class="space-y-1.5 max-w-md mx-auto">
      <p class="text-sm font-medium capitalize">{{ phase }} phase</p>
      <Progress :model-value="phaseProgress" class="h-3" />
      <p class="text-xs text-muted-foreground font-mono">
        Кадр {{ phaseFrameIndex + 1 }} / {{ phaseTotalFrames }}
      </p>
    </div>

    <div class="space-y-1 max-w-md mx-auto">
      <p class="text-xs text-muted-foreground">Общий прогресс</p>
      <Progress :model-value="totalProgress" class="h-2" />
      <p class="text-xs font-mono text-muted-foreground">{{ fmtTime(totalElapsed) }}</p>
    </div>

    <Button v-if="canStop" variant="destructive" @click="$emit('stop')">
      Остановить
    </Button>
  </div>
</template>