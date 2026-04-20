import type { DecodingCapability } from '@/entities/browser-profile/model/types'

interface DecodingConfig {
  label: string
  config: MediaDecodingConfiguration
}

const DECODING_CONFIGS: DecodingConfig[] = [
  {
    label: 'H.264 1080p30',
    config: {
      type: 'file',
      video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, bitrate: 4000000, framerate: 30 },
    },
  },
  {
    label: 'H.264 1080p60',
    config: {
      type: 'file',
      video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, bitrate: 8000000, framerate: 60 },
    },
  },
  {
    label: 'H.264 2160p30',
    config: {
      type: 'file',
      video: { contentType: 'video/mp4; codecs="avc1.640033"', width: 3840, height: 2160, bitrate: 20000000, framerate: 30 },
    },
  },
  {
    label: 'VP9 1080p30',
    config: {
      type: 'file',
      video: { contentType: 'video/webm; codecs="vp09.00.10.08"', width: 1920, height: 1080, bitrate: 4000000, framerate: 30 },
    },
  },
]

export async function collectDecodingCapabilities(): Promise<Record<string, DecodingCapability>> {
  if (!navigator.mediaCapabilities) {
    return Object.fromEntries(
      DECODING_CONFIGS.map(({ label }) => [label, { supported: false, smooth: false, powerEfficient: false }]),
    )
  }
  const entries = await Promise.all(
    DECODING_CONFIGS.map(async ({ label, config }) => {
      try {
        const result = await navigator.mediaCapabilities.decodingInfo(config)
        return [label, { supported: result.supported, smooth: result.smooth, powerEfficient: result.powerEfficient }] as const
      } catch {
        return [label, { supported: false, smooth: false, powerEfficient: false }] as const
      }
    }),
  )
  return Object.fromEntries(entries)
}
