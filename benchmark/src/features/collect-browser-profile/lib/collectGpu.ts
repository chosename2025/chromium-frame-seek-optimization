import type { GpuInfo } from '@/entities/browser-profile/model/types'

export function collectGpu(): GpuInfo {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
  if (!gl || !(gl instanceof WebGLRenderingContext)) {
    return { renderer: 'unavailable', vendor: 'unavailable', version: 'unavailable' }
  }
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  if (!ext) {
    return {
      renderer: 'unavailable',
      vendor: 'unavailable',
      version: gl.getParameter(gl.VERSION) ?? 'unavailable',
    }
  }
  return {
    renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? 'unavailable',
    vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) ?? 'unavailable',
    version: gl.getParameter(gl.VERSION) ?? 'unavailable',
  }
}
