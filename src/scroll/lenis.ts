import Lenis from 'lenis'

/**
 * One Lenis instance for the whole app, plus a single rAF loop that every
 * scroll-driven component subscribes to. Components must never add their own
 * scroll listeners: reading layout from N listeners is what makes these sites
 * janky. One read per frame, shared.
 */
let lenis: Lenis | null = null
let raf = 0
const subscribers = new Set<() => void>()

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function startScroll() {
  if (lenis || typeof window === 'undefined') return
  // With reduced motion we still need the tick (components read scroll position),
  // but the smoothing itself is switched off so scrolling stays native-feeling.
  lenis = new Lenis({
    duration: prefersReducedMotion() ? 0 : 1.05,
    smoothWheel: !prefersReducedMotion(),
    touchMultiplier: 1.6,
  })
  const loop = (time: number) => {
    lenis?.raf(time)
    for (const fn of subscribers) fn()
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
}

export function stopScroll() {
  cancelAnimationFrame(raf)
  lenis?.destroy()
  lenis = null
}

export function onTick(fn: () => void) {
  subscribers.add(fn)
  return () => void subscribers.delete(fn)
}

export function scrollTo(target: string | HTMLElement, offset = 0) {
  lenis?.scrollTo(target, { offset })
}
