<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import type { VideoMeta } from '@/entities/video/model/types'

const props = defineProps<{
  video: VideoMeta
  currentSeekIndex: number
  blobUrl: string
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const currentFrame = ref(0)

watch(
  () => props.currentSeekIndex,
  (seekIndex) => {
    if (!videoRef.value || videoRef.value.readyState < 1) return
    const targetTime = (seekIndex / props.video.fps) % props.video.durationSec
    videoRef.value.currentTime = targetTime
    currentFrame.value = seekIndex
  },
)

onUnmounted(() => {
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.src = ''
  }
})
</script>

<template>
  <div class="border rounded-lg overflow-hidden bg-card p-3 space-y-2">
    <div class="text-xs font-mono truncate text-muted-foreground">
      {{ video.filename }}
    </div>
    <div class="relative aspect-video bg-black rounded-md overflow-hidden">
      <video
        ref="videoRef"
        :src="blobUrl"
        class="w-full h-full object-contain"
        playsinline
        muted
        preload="auto"
      />
    </div>
    <div class="text-xs text-muted-foreground font-mono">
      Frame: {{ currentFrame }} / {{ Math.round(video.durationSec * video.fps) }}
    </div>
  </div>
</template>
