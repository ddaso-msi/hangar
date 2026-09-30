import { useEffect, useRef, useState } from 'react'
import { useScrollProgress } from './useScrollProgress'
import { prefersReducedMotion } from './lenis'
import { plateSrc } from '../lib/catalog'

interface Manifest {
  slug: string
  aspect: number
  tiers: Record<string, { count: number; width: number; bytes: number }>
}

/** Enough frames to scrub the opening beat while the rest still streams in. */
const PRIME = 12

function pickTier(): 'desktop' | 'mobile' {
  if (typeof window === 'undefined') return 'desktop'
  const narrow = window.matchMedia('(max-width: 767px)').matches
  const mem = (navigator as { deviceMemory?: number }).deviceMemory
  return narrow || (typeof mem === 'number' && mem <= 4) ? 'mobile' : 'desktop'
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Darkens under the nav and, more strongly, under the title block in the lower
 * half, so type stays legible whatever frame is behind it.
 */
const SCRIM =
  'linear-gradient(to bottom, rgba(6,7,10,.55) 0%, rgba(6,7,10,0) 18%, rgba(6,7,10,0) 42%, rgba(6,7,10,.78) 72%, #06070A 100%)'

interface Props {
  slug: string
  /** Section height in viewport units. More height = slower, more deliberate scrub. */
  vh?: number
  /**
   * Scroll-scrub a rendered frame sequence. When false, the stage shows a single
   * still (the poster) — used for models that have a hero render but no flythrough.
   */
  sequence?: boolean
  /**
   * Still shown before frames arrive, and the whole image when `sequence` is false.
   * Defaults to frame 0 when scrubbing, so the swap from image to canvas is invisible.
   */
  poster?: string
  /** Progress at which the last frame is reached. The rest of the section holds it. */
  scrubEnd?: number
  /**
   * Rendered beneath the image layer, inside the same pinned viewport. The image
   * layer dissolves away across `dissolve` to reveal it. Because both share one
   * sticky stage, there is no second copy of the last frame scrolling in behind.
   */
  underlay?: React.ReactNode
  dissolve?: [number, number]
  /** Hold the image layer opaque until the underlay reports it has drawn. */
  underlayReady?: boolean
  /**
   * 'cover' crops the still to fill the screen. 'height' shows it at full
   * viewport height, centred, so a portrait still is never cut off -- the side
   * bars take `backdrop`. The inspector reproduces whichever framing is shown.
   */
  fit?: 'cover' | 'height'
  /** CSS background for the stage: what the side bars of a 'height' still show. */
  backdrop?: string
  /**
   * When the title fades (a progress range), the legibility scrim goes with it,
   * so the still reaches the dissolve exactly as rendered -- otherwise the lower
   * screen would visibly brighten as the scrimmed still gives way to the canvas.
   */
  scrimOut?: [number, number]
  onProgress?: (p: number) => void
  className?: string
  children?: React.ReactNode
}

export function FrameSequence({
  slug,
  vh = 400,
  sequence = true,
  poster = sequence ? 'first' : 'poster',
  scrubEnd = 1,
  underlay,
  dissolve,
  underlayReady = true,
  fit = 'cover',
  backdrop,
  scrimOut,
  onProgress,
  className = '',
  children,
}: Props) {
  const section = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const frames = useRef<HTMLImageElement[]>([])
  const drawn = useRef(-1)
  const progress = useRef(0)
  const readyRef = useRef(underlayReady)
  const [primed, setPrimed] = useState(false)
  const paintRef = useRef(() => {})
  const reduced = prefersReducedMotion()
  const scrub = sequence && !reduced

  useEffect(() => {
    if (!scrub) return
    let cancelled = false
    const tier = pickTier()
    const load = (i: number) =>
      new Promise<HTMLImageElement>((resolve) => {
        const img = new Image()
        img.decoding = 'async'
        img.src = `/assets/seq/${slug}/${tier}/${String(i).padStart(4, '0')}.avif`
        // decode() gets the decode off the main thread when it can, but it is never
        // a gate: in a hidden tab it stays pending until the tab is shown, and a
        // loaded image can be drawn to a canvas regardless.
        img.onload = () =>
          Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 250))]).then(() => resolve(img))
        img.onerror = () => resolve(img)
      })

    ;(async () => {
      const res = await fetch(`/assets/seq/${slug}/manifest.json`)
      if (!res.ok || cancelled) return
      const manifest: Manifest = await res.json()
      const count = manifest.tiers[tier]?.count ?? 0
      if (!count) return
      frames.current = new Array(count)
      const first = await Promise.all(Array.from({ length: Math.min(PRIME, count) }, (_, i) => load(i)))
      if (cancelled) return
      first.forEach((img, i) => (frames.current[i] = img))
      setPrimed(true)
      // The rest streams in behind the scrub, in the order the viewer reaches them.
      // Each arrival repaints, so a viewer parked mid-sequence converges on the
      // right frame without having to scroll.
      for (let i = PRIME; i < count; i++) {
        if (cancelled) return
        frames.current[i] = await load(i)
        paintRef.current()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, scrub])

  const isLoaded = (i: number) => {
    const img = frames.current[i]
    return !!img && img.complete && img.naturalWidth > 0
  }

  // Cover-fit at capped DPR. Canvas rather than <img> so swapping frames never
  // touches layout.
  const draw = (index: number) => {
    const c = canvas.current
    const img = frames.current[index]
    if (!c || !img?.complete || img.naturalWidth === 0) return
    const ctx = c.getContext('2d', { alpha: false })
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth * dpr
    const h = c.clientHeight * dpr
    if (c.width !== w || c.height !== h) {
      c.width = w
      c.height = h
    }
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    ctx.drawImage(img, (w - img.naturalWidth * s) / 2, (h - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s)
    drawn.current = index
    // Exposed for QA: which frame is on screen, checkable without reading pixels.
    c.dataset.frame = String(index)
  }

  const paint = () => {
    const p = progress.current
    if (scrub) {
      const n = frames.current.length
      if (n) {
        const target = Math.min(n - 1, Math.round(clamp01(p / scrubEnd) * (n - 1)))
        // Draw the closest frame that has actually arrived. Not "the last one drawn":
        // after a reload the browser restores scroll mid-page, and holding frame 0
        // until the viewer happens to scroll again would show the wrong shot.
        let best = -1
        for (let d = 0; d < n && best < 0; d++) {
          if (isLoaded(target - d)) best = target - d
          else if (isLoaded(target + d)) best = target + d
        }
        if (best >= 0 && best !== drawn.current) draw(best)
      }
    }
    if (dissolve && layer.current) {
      const [a, b] = dissolve
      const t = readyRef.current ? clamp01((p - a) / (b - a)) : 0
      layer.current.style.opacity = String(1 - t)
      // Once it has faded, the image layer must stop swallowing drags meant for the underlay.
      layer.current.style.pointerEvents = t > 0.95 ? 'none' : ''
    }
    if (scrimOut && scrim.current) {
      const [a, b] = scrimOut
      scrim.current.style.opacity = String(1 - clamp01((p - a) / (b - a)))
    }
  }

  paintRef.current = paint

  useEffect(() => {
    readyRef.current = underlayReady
    paint()
  }, [underlayReady])

  useScrollProgress(section, (p) => {
    progress.current = p
    onProgress?.(p)
    paint()
  })

  useEffect(() => {
    if (!primed) return
    paint()
    const onResize = () => draw(Math.max(0, drawn.current))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [primed])

  // Reduced motion: no pin, no scrub, no dissolve. Show the still, then the
  // underlay as its own block below it.
  if (reduced) {
    return (
      <>
        <section className={`relative h-screen overflow-hidden ${className}`}>
          <img src={plateSrc(slug, poster, 1600)} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0" style={{ background: SCRIM }} />
          {children}
        </section>
        {underlay && <section className="relative h-screen">{underlay}</section>}
      </>
    )
  }

  return (
    <section ref={section} className={`relative ${className}`} style={{ height: `${vh}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        {underlay && <div className="absolute inset-0">{underlay}</div>}

        {/* z-30 sits above the underlay's HTML overlays (hotspot markers use z 0-20),
            so nothing belonging to the live model shows through the still. */}
        <div ref={layer} className="absolute inset-0 z-30" style={backdrop ? { background: backdrop } : undefined}>
          <img
            src={plateSrc(slug, poster, 1600)}
            alt=""
            aria-hidden="true"
            className={
              fit === 'height'
                ? // Full viewport height, centred; on a phone the sides crop, on a
                  // wide screen the sides are feathered into the stage backdrop.
                  'absolute left-1/2 top-0 h-full w-auto max-w-none -translate-x-1/2 [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)]'
                : 'absolute inset-0 h-full w-full object-cover'
            }
            fetchPriority="high"
          />
          {scrub && (
            <canvas
              ref={canvas}
              className="absolute inset-0 h-full w-full transition-opacity duration-700"
              style={{ opacity: primed ? 1 : 0 }}
            />
          )}
          <div ref={scrim} className="pointer-events-none absolute inset-0" style={{ background: SCRIM }} />
          {children}
        </div>
      </div>
    </section>
  )
}
