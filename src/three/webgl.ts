let cached: boolean | null = null

/**
 * Can this browser create a WebGL context at all? Some cannot: a blocklisted
 * GPU, hardware acceleration switched off, a sandboxed VM. Checked once, before
 * three.js is ever imported, so those visitors never download it either.
 */
export function hasWebGL(): boolean {
  if (cached !== null) return cached
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    cached = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}
