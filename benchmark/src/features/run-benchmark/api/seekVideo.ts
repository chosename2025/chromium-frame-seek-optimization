export function seekTo(video: HTMLVideoElement, time: number): Promise<number> {
  return new Promise((resolve) => {
    const start = performance.now()
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve(performance.now() - start)
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}
