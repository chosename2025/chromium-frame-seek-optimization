const CODEC_STRINGS = [
  'video/mp4; codecs="avc1.42E01E"',
  'video/mp4; codecs="avc1.640029"',
  'video/webm; codecs="vp9"',
  'video/webm; codecs="vp8"',
  'video/mp4; codecs="av01.0.05M.08"',
  'video/ogg; codecs="theora"',
] as const

export function collectCodecs(): Record<string, 'probably' | 'maybe' | ''> {
  const video = document.createElement('video')
  return Object.fromEntries(
    CODEC_STRINGS.map((codec) => [codec, video.canPlayType(codec) as 'probably' | 'maybe' | '']),
  )
}
