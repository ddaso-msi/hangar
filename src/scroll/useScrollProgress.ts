import { useEffect, useRef } from 'react'
import { onTick } from './lenis'

/**
 * Progress of a pinned section, 0 at the moment its top reaches the viewport top
 * and 1 when its bottom does. Delivered via callback rather than state so it can
 * run at 60fps without re-rendering React.
 */
export function useScrollProgress(
  ref: React.RefObject<HTMLElement | null>,
  onProgress: (p: number) => void
) {
  const cb = useRef(onProgress)
  cb.current = onProgress

  useEffect(() => {
    let last = -1
    return onTick(() => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const travel = rect.height - window.innerHeight
      if (travel <= 0) return
      const p = Math.min(1, Math.max(0, -rect.top / travel))
      // Sub-pixel changes are not worth a redraw.
      if (Math.abs(p - last) < 0.0005) return
      last = p
      cb.current(p)
    })
  }, [ref])
}
