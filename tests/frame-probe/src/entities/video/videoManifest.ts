import type { VideoManifestItem } from '@/entities/test-result/types'

export const videoManifest: VideoManifestItem[] = [
  { filename: 'pixel_4x4_2fps_H.264.mp4',   path: '/videos/pixel_4x4_2fps_H.264.mp4',   width: 4,   height: 4,   fps: 2,  codec: 'H.264', totalFrames: 16,   durationSec: 8.0  },
  { filename: 'pixel_4x4_2fps_VP9.webm',     path: '/videos/pixel_4x4_2fps_VP9.webm',   width: 4,   height: 4,   fps: 2,  codec: 'VP9',   totalFrames: 16,   durationSec: 8.0  },
  { filename: 'pixel_8x8_4fps_H.264.mp4',   path: '/videos/pixel_8x8_4fps_H.264.mp4',   width: 8,   height: 8,   fps: 4,  codec: 'H.264', totalFrames: 64,   durationSec: 16.0 },
  { filename: 'pixel_8x8_4fps_VP9.webm',    path: '/videos/pixel_8x8_4fps_VP9.webm',   width: 8,   height: 8,   fps: 4,  codec: 'VP9',   totalFrames: 64,   durationSec: 16.0 },
  { filename: 'pixel_16x16_10fps_H.264.mp4',path: '/videos/pixel_16x16_10fps_H.264.mp4',width: 16,  height: 16,  fps: 10, codec: 'H.264', totalFrames: 256,  durationSec: 25.6 },
  { filename: 'pixel_16x16_10fps_VP9.webm', path: '/videos/pixel_16x16_10fps_VP9.webm',width: 16,  height: 16,  fps: 10, codec: 'VP9',   totalFrames: 256,  durationSec: 25.6 },
  { filename: 'pixel_32x32_15fps_H.264.mp4',path: '/videos/pixel_32x32_15fps_H.264.mp4',width: 32,  height: 32,  fps: 15, codec: 'H.264', totalFrames: 1024, durationSec: 68.3 },
  { filename: 'pixel_32x32_15fps_VP9.webm', path: '/videos/pixel_32x32_15fps_VP9.webm',width: 32,  height: 32,  fps: 15, codec: 'VP9',   totalFrames: 1024, durationSec: 68.3 },
  { filename: 'pixel_64x64_24fps_H.264.mp4',path: '/videos/pixel_64x64_24fps_H.264.mp4',width: 64,  height: 64,  fps: 24, codec: 'H.264', totalFrames: 4096, durationSec: 170.7},
  { filename: 'pixel_64x64_24fps_VP9.webm', path: '/videos/pixel_64x64_24fps_VP9.webm',width: 64,  height: 64,  fps: 24, codec: 'VP9',   totalFrames: 4096, durationSec: 170.7},
  { filename: 'pixel_128x128_30fps_H.264.mp4',path:'/videos/pixel_128x128_30fps_H.264.mp4',width:128,height:128,fps:30,codec:'H.264',totalFrames:16384,durationSec:546.1},
  { filename: 'pixel_128x128_30fps_VP9.webm',path:'/videos/pixel_128x128_30fps_VP9.webm',width:128,height:128,fps:30,codec:'VP9',  totalFrames:16384,durationSec:546.1},
]