<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface FrameResult {
  index: number
  expected: { x: number; y: number }
  found: { x: number; y: number } | null
  brightness: number
  ok: boolean
  offByOne: boolean
}

interface PhaseResult {
  phase: 'forward' | 'backward' | 'random'
  matches: number
  offByOneCount: number
  accuracy: number
  avgSeekMs: number
  processingFps: number
  frames: FrameResult[]
}

interface TestResult {
  videoName: string
  width: number
  height: number
  fps: number
  totalFrames: number
  phases: PhaseResult[]
}

const testState = ref<'idle' | 'running' | 'done' | 'error'>('idle')
const progress = ref(0)
const progressLabel = ref('')
const result = ref<TestResult | null>(null)
const errorMsg = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const expandedPhase = ref<'forward' | 'backward' | 'random' | null>(null)
const manualFps = ref<number | null>(null)

function onFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  selectedFile.value = f
  result.value = null
  testState.value = 'idle'
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise(resolve => {
    const handler = () => { video.removeEventListener('seeked', handler); resolve() }
    video.addEventListener('seeked', handler)
    const maxTime = isFinite(video.duration) ? video.duration - 0.0001 : 1e9
    video.currentTime = Math.max(0, Math.min(time, maxTime))
  })
}

async function runTest() {
  if (!selectedFile.value) return
  testState.value = 'running'
  progress.value = 0
  result.value = null
  errorMsg.value = ''

  const file = selectedFile.value
  const url = URL.createObjectURL(file)

  const video = document.createElement('video')
  video.muted = true
  video.src = url

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Не удалось загрузить видео'))
    })

    const W = video.videoWidth
    const H = video.videoHeight
    const totalFrames = W * H

    // MediaRecorder often produces Infinity duration — fall back to manual FPS.
    let fps: number
    if (isFinite(video.duration) && video.duration > 0) {
      fps = totalFrames / video.duration
    } else if (manualFps.value && manualFps.value > 0) {
      fps = manualFps.value
    } else {
      throw new Error(`Длительность видео неизвестна (Infinity). Укажите FPS вручную.`)
    }

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    // Helper: scan frame for brightest pixel
    function scanFrame(): { x: number; y: number; brightness: number } {
      ctx.drawImage(video, 0, 0)
      const data = ctx.getImageData(0, 0, W, H).data
      let maxB = -1, fx = -1, fy = -1
      for (let i = 0; i < W * H; i++) {
        const off = i * 4
        const b = Math.round(data[off] * 0.299 + data[off + 1] * 0.587 + data[off + 2] * 0.114)
        if (b > maxB) { maxB = b; fx = i % W; fy = Math.floor(i / W) }
      }
      return { x: fx, y: fy, brightness: maxB }
    }

    // Helper: detect isolated off-by-one errors
    function markOffByOne(frames: FrameResult[]): number {
      let count = 0
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i]
        if (f.ok || !f.found) continue
        const dist = Math.abs(f.found.x - f.expected.x) + Math.abs(f.found.y - f.expected.y)
        if (dist !== 1) continue
        // Check neighbors are not also marked as errors
        const prevOk = i === 0 || frames[i - 1].ok || frames[i - 1].offByOne
        const nextOk = i === frames.length - 1 || frames[i + 1].ok || frames[i + 1].offByOne
        if (prevOk && nextOk) {
          f.offByOne = true
          count++
        }
      }
      return count
    }

    // Run three test phases
    const phases: PhaseResult[] = []
    const t0 = performance.now()

    for (const phase of ['forward', 'backward', 'random'] as const) {
      const indices = Array.from({ length: totalFrames }, (_, i) => i)
      if (phase === 'backward') indices.reverse()
      else if (phase === 'random') indices.sort(() => Math.random() - 0.5)

      const frames: FrameResult[] = []
      let matches = 0
      let totalSeekMs = 0

      for (let idx = 0; idx < indices.length; idx++) {
        const px = indices[idx]
        const expX = px % W
        const expY = Math.floor(px / W)

        const seekStart = performance.now()
        await seekTo(video, (px + 0.75) / fps)
        const { x: foundX, y: foundY, brightness: maxBrightness } = scanFrame()
        totalSeekMs += performance.now() - seekStart

        const ok = maxBrightness > 200 && foundX === expX && foundY === expY
        const frame: FrameResult = {
          index: px,
          expected: { x: expX, y: expY },
          found: maxBrightness > 10 ? { x: foundX, y: foundY } : null,
          brightness: maxBrightness,
          ok,
          offByOne: false,
        }
        frames.push(frame)

        if (ok) matches++

        const pct = Math.round(((idx + 1) / totalFrames) * 100)
        progress.value = pct
        progressLabel.value = `${phase}: ${idx + 1}/${totalFrames}`

        if (idx % 10 === 0) await new Promise(r => setTimeout(r, 0))
      }

      // Post-process: mark isolated off-by-one errors and count them
      const offByOneCount = markOffByOne(frames)
      matches += offByOneCount

      const elapsed = (performance.now() - t0) / 1000
      phases.push({
        phase,
        matches,
        offByOneCount,
        accuracy: (matches / totalFrames) * 100,
        avgSeekMs: totalFrames ? totalSeekMs / totalFrames : 0,
        processingFps: elapsed > 0 ? totalFrames / elapsed : 0,
        frames,
      })
    }

    result.value = {
      videoName: file.name,
      width: W,
      height: H,
      fps: Math.round(fps * 10) / 10,
      totalFrames,
      phases,
    }
    testState.value = 'done'
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
    testState.value = 'error'
  } finally {
    video.remove()
    URL.revokeObjectURL(url)
  }
}

function accuracyVariant(val: number): 'default' | 'secondary' | 'destructive' {
  if (val >= 99) return 'default'
  if (val >= 90) return 'secondary'
  return 'destructive'
}

function frameVariant(f: FrameResult): 'default' | 'secondary' | 'destructive' {
  if (f.ok) return 'default'
  if (f.offByOne) return 'secondary'
  return 'destructive'
}

function fmt(val: number, dec = 1, suffix = ''): string {
  return val.toFixed(dec) + suffix
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground p-6">
    <div class="max-w-5xl mx-auto space-y-6">

      <!-- Header -->
      <div class="text-center space-y-1 py-2">
        <h1 class="text-xl font-semibold tracking-tight">Pixel Seek Accuracy Test</h1>
        <p class="text-sm text-muted-foreground">
          Три фазы seek: Forward, Backward, Random
        </p>
      </div>

      <!-- File picker + run -->
      <div class="flex items-center gap-3 flex-wrap">
        <input
          ref="fileInput"
          type="file"
          accept="video/*"
          class="hidden"
          @change="onFileChange"
        />
        <Button variant="outline" @click="fileInput?.click()">
          Выбрать видео
        </Button>
        <span class="text-sm text-muted-foreground truncate">
          {{ selectedFile ? selectedFile.name : 'Файл не выбран' }}
        </span>
        <div class="flex items-center gap-1.5">
          <label class="text-xs text-muted-foreground">FPS:</label>
          <input
            type="number"
            min="1"
            max="120"
            placeholder="авто"
            class="w-20 rounded-md border bg-background px-2 py-1 text-sm"
            :value="manualFps"
            @input="manualFps = ($event.target as HTMLInputElement).valueAsNumber || null"
          />
        </div>
        <Button
          :disabled="!selectedFile || testState === 'running'"
          @click="runTest"
        >
          {{ testState === 'running' ? 'Тест…' : testState === 'done' ? 'Повторить' : 'Запустить тест' }}
        </Button>
      </div>

      <!-- Progress -->
      <div v-if="testState === 'running'" class="space-y-1">
        <Progress :model-value="progress" class="h-2" />
        <p class="text-xs text-muted-foreground animate-pulse">{{ progressLabel }}</p>
      </div>

      <!-- Error -->
      <div v-if="testState === 'error'" class="rounded-lg border border-destructive p-4 text-sm text-destructive">
        {{ errorMsg }}
      </div>

      <!-- Results -->
      <div v-if="result" class="space-y-6">

        <!-- Info cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div class="rounded-lg border bg-card p-3 space-y-1">
            <div class="text-xs text-muted-foreground">Разрешение</div>
            <div class="font-mono font-bold">{{ result.width }}×{{ result.height }}</div>
          </div>
          <div class="rounded-lg border bg-card p-3 space-y-1">
            <div class="text-xs text-muted-foreground">Кадры / FPS</div>
            <div class="font-mono font-bold">{{ result.totalFrames }} / {{ fmt(result.fps, 1) }}</div>
          </div>
          <div class="rounded-lg border bg-card p-3 space-y-1">
            <div class="text-xs text-muted-foreground">Avg seek</div>
            <div class="font-mono font-bold">
              {{ result.phases.length ? fmt(result.phases[0].avgSeekMs, 0, ' ms') : '—' }}
            </div>
          </div>
          <div class="rounded-lg border bg-card p-3 space-y-1">
            <div class="text-xs text-muted-foreground">Скорость</div>
            <div class="font-mono font-bold">
              {{ result.phases.length ? fmt(result.phases[0].processingFps, 1, ' fps') : '—' }}
            </div>
          </div>
        </div>

        <!-- Phase results -->
        <div class="space-y-4">
          <div
            v-for="phase in result.phases"
            :key="phase.phase"
            class="rounded-lg border overflow-hidden"
          >
            <!-- Phase header -->
            <div
              class="bg-muted p-4 cursor-pointer hover:bg-muted/80 transition"
              @click="expandedPhase = expandedPhase === phase.phase ? null : phase.phase"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <h3 class="font-semibold capitalize">{{ phase.phase }}</h3>
                  <Badge :variant="accuracyVariant(phase.accuracy)" class="tabular-nums">
                    {{ fmt(phase.accuracy, 2, '%') }}
                  </Badge>
                </div>
                <div class="text-sm text-muted-foreground space-x-3 tabular-nums">
                  <span>{{ phase.matches }}/{{ result.totalFrames }}</span>
                  <span v-if="phase.offByOneCount" class="text-yellow-600">+{{ phase.offByOneCount }} off-by-1</span>
                </div>
              </div>
            </div>

            <!-- Frame table (expanded) -->
            <div v-if="expandedPhase === phase.phase" class="overflow-auto max-h-96 border-t">
              <table class="w-full text-xs">
                <thead class="sticky top-0 bg-muted/50">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">Кадр</th>
                    <th class="px-3 py-2 text-left font-medium">Ожид.</th>
                    <th class="px-3 py-2 text-left font-medium">Найден</th>
                    <th class="px-3 py-2 text-left font-medium">Яркость</th>
                    <th class="px-3 py-2 text-left font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="f in phase.frames"
                    :key="f.index"
                    :class="f.ok ? '' : f.offByOne ? 'bg-yellow-50/30' : 'bg-destructive/10'"
                  >
                    <td class="px-3 py-1.5 tabular-nums">{{ f.index }}</td>
                    <td class="px-3 py-1.5 font-mono">({{ f.expected.x }}, {{ f.expected.y }})</td>
                    <td class="px-3 py-1.5 font-mono">
                      <span v-if="f.found">({{ f.found.x }}, {{ f.found.y }})</span>
                      <span v-else class="text-muted-foreground">—</span>
                    </td>
                    <td class="px-3 py-1.5 tabular-nums">{{ f.brightness }}</td>
                    <td class="px-3 py-1.5">
                      <Badge :variant="frameVariant(f)" class="text-xs">
                        {{ f.ok ? '✓' : f.offByOne ? '±1' : '✗' }}
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>
  </div>
</template>
