import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { bySlug, plateSrc } from '../lib/catalog'
import { PLATE_ASPECT, POSTER_BACKDROP, SEAMS } from '../lib/plates.generated'
import type { Model as ModelType } from '../lib/catalog'
import { FrameSequence } from '../scroll/FrameSequence'
import { Plate } from '../ui/Plate'
import { Reveal } from '../ui/Reveal'
import { SpecTable } from '../ui/SpecTable'
import { DownloadPanel } from '../ui/DownloadPanel'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { hasWebGL } from '../three/webgl'

// three.js is a third of the bundle. It must never load on a page without a model.
const Inspector = lazy(() =>
  import('../three/Inspector').then((m) => ({ default: m.Inspector }))
)

const PLATE_LABEL: Record<string, string> = {
  top: 'Top', front: 'Front', profile: 'Profile', side: 'Side', rear: 'Rear',
  'detail-cockpit': 'Canopy', 'detail-exhaust': 'Exhaust', 'detail-intake': 'Intake',
  'detail-hub': 'Hub', 'detail-window': 'Viewport', 'detail-panel': 'Wing panel',
  'detail-knee': 'Knee joint', 'detail-foot': 'Footpad', 'detail-guns': 'Chin guns',
  'detail-dome': 'Dome', 'detail-low': 'Low angle', 'detail-shoulder': 'Shoulder hub', 'detail-vents': 'Vents',
}

/** Column classes for a plate grid, so three plates make one row rather than a row and an orphan. */
const gridCols = (n: number) => (n === 3 ? 'sm:grid-cols-3' : n === 2 ? 'sm:grid-cols-2' : n >= 4 ? 'sm:grid-cols-2' : '')

export default function ModelPage() {
  const { slug } = useParams()
  const model = bySlug(slug)

  if (!model) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-40 text-center">
        <h1 className="font-display text-3xl font-semibold">No such model</h1>
        <Link to="/models" className="mt-6 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-ember">
          Back to the hangar
        </Link>
      </div>
    )
  }

  return (
    <>
      {model.heroKind === 'live' ? <LiveStage model={model} /> : <Hero model={model} />}
      {model.heroKind !== 'live' && <Pending model={model} />}
      <Blueprints model={model} />
      <Details model={model} />
      <Closing model={model} />
    </>
  )
}

function Title({ model }: { model: ModelType }) {
  return (
    <div className="pointer-events-none absolute inset-0 mx-auto flex max-w-[1400px] flex-col justify-end px-5 pb-14 sm:px-8 sm:pb-20">
      <p className="label mb-3">{model.subtitle}</p>
      <h1 className="font-display text-[clamp(2.8rem,9vw,7rem)] font-bold leading-[0.9]">{model.title}</h1>
      {model.dims && <p className="mt-4 font-mono text-[13px] text-dim">{model.dims}</p>}
    </div>
  )
}

/* Act 1 for a model with no live GLB yet: the flythrough (or the hero render), alone. */
function Hero({ model }: { model: ModelType }) {
  if (model.hasSequence) {
    return (
      <FrameSequence slug={model.slug} vh={320}>
        <Title model={model} />
      </FrameSequence>
    )
  }
  // A portrait render cropped full-bleed on a landscape screen loses its top and
  // bottom -- for a droid, the dome. On wide screens it is set whole against the
  // right edge, its left edge feathered into a field of its own measured backdrop
  // colour; on phones, where portrait fits, it goes full-bleed.
  const portrait = (PLATE_ASPECT[model.slug]?.poster ?? 1.5) < 0.95
  return (
    <section className="relative h-screen overflow-hidden" style={{ background: POSTER_BACKDROP[model.slug] }}>
      <img
        src={plateSrc(model.slug, 'poster', 1600)}
        alt={`${model.title} hero render`}
        fetchPriority="high"
        className={
          portrait
            ? 'absolute inset-0 h-full w-full object-cover lg:left-auto lg:w-auto lg:max-w-[62%] lg:object-contain lg:[mask-image:linear-gradient(to_right,transparent,black_24%)]'
            : 'absolute inset-0 h-full w-full object-cover'
        }
      />
      <div className="absolute inset-0 bg-gradient-to-b from-void/40 via-transparent to-void" />
      <Title model={model} />
    </section>
  )
}

/**
 * Acts 1 and 2 on one pinned stage: arrival, then the seam.
 *
 * The live inspector sits underneath the image layer from the start. Scroll
 * first scrubs the flythrough to its final frame, holds it, then dissolves the
 * image layer to reveal the model -- whose camera opens on the angle and framing
 * measured from that same final frame. One stage means one copy of the frame;
 * there is no second section sliding in behind it.
 */
function LiveStage({ model }: { model: ModelType }) {
  const [mounted, setMounted] = useState(false)
  const [ready, setReady] = useState(false)
  const [active, setActive] = useState(false)
  // No WebGL, or the viewer failed: the stage still scrubs and holds the final
  // frame -- it simply never dissolves -- and says why.
  const [noViewer, setNoViewer] = useState(() => !hasWebGL())
  const activeRef = useRef(false)
  const title = useRef<HTMLDivElement>(null)
  const note = useRef<HTMLParagraphElement>(null)

  // With a flythrough: scrub to 50%, hold to 60%, dissolve by 72%, then the
  // model stays pinned for the last stretch. Without one, the still is all there
  // is, so the dissolve comes sooner.
  const t = model.hasSequence
    ? { vh: 460, scrubEnd: 0.5, dissolve: [0.6, 0.72] as [number, number], titleOut: [0.4, 0.5] }
    : { vh: 300, scrubEnd: 1, dissolve: [0.2, 0.42] as [number, number], titleOut: [0.08, 0.18] }

  // Start fetching three.js and the GLB shortly after load, or as soon as the
  // viewer starts scrolling -- whichever comes first. Long before the dissolve.
  useEffect(() => {
    if (noViewer) return
    const go = () => setMounted(true)
    const later = () => window.setTimeout(go, 2000)
    if (document.readyState === 'complete') {
      const id = later()
      return () => clearTimeout(id)
    }
    window.addEventListener('load', later, { once: true })
    return () => window.removeEventListener('load', later)
  }, [noViewer])

  const onProgress = (p: number) => {
    if (!mounted && !noViewer && p > 0.05) setMounted(true)
    const shouldRun = p >= t.dissolve[0] - 0.03
    if (shouldRun !== activeRef.current) {
      activeRef.current = shouldRun
      setActive(shouldRun)
    }
    const [a, b] = t.titleOut
    const out = Math.min(1, Math.max(0, (p - a) / (b - a)))
    if (title.current) title.current.style.opacity = String(1 - out)
    // The fallback note takes the title's place once the title has gone.
    if (note.current) note.current.style.opacity = String(out)
  }

  return (
    <FrameSequence
      slug={model.slug}
      vh={t.vh}
      sequence={model.hasSequence}
      poster={model.hasSequence ? 'first' : 'seam'}
      scrubEnd={t.scrubEnd}
      dissolve={t.dissolve}
      underlayReady={ready}
      fit={SEAMS[model.slug]?.fit}
      backdrop={SEAMS[model.slug]?.gradient ? `linear-gradient(to bottom, ${SEAMS[model.slug]!.gradient!.join(', ')})` : undefined}
      scrimOut={t.titleOut as [number, number]}
      onProgress={onProgress}
      underlay={
        mounted && !noViewer && (
          <ErrorBoundary fallback={null} onError={() => setNoViewer(true)}>
            <Suspense fallback={null}>
              <Inspector
                slug={model.slug}
                hotspots={model.hotspots}
                lengthM={model.lengthM}
                className="absolute inset-0 h-full w-full"
                onReady={() => setReady(true)}
                active={active}
              />
            </Suspense>
          </ErrorBoundary>
        )
      }
    >
      <div ref={title}>
        <Title model={model} />
      </div>
      {noViewer && (
        <p
          ref={note}
          style={{ opacity: 0 }}
          // Its own dark backing: on a light studio floor the stage gives no contrast.
          className="pointer-events-none absolute inset-x-0 bottom-10 mx-auto w-fit max-w-[min(28rem,calc(100%-2.5rem))] rounded-lg bg-void/75 px-4 py-2.5 text-center font-mono text-[11px] leading-relaxed text-dim backdrop-blur"
        >
          This browser can't run the 3D viewer, so the model stays as a render. The views and
          downloads below all still work.
        </p>
      )}
    </FrameSequence>
  )
}

/* Stands in for the inspector on models whose bake has not been run. */
function Pending({ model }: { model: ModelType }) {
  return (
    <section className="border-y border-edge bg-hull/40">
      <div className="mx-auto max-w-2xl px-5 py-24 text-center sm:px-8">
        <p className="label mb-4">Not inspectable yet</p>
        <p className="text-[15px] leading-relaxed text-dim">{model.pending}</p>
      </div>
    </section>
  )
}

/* Act 3 — the orthographic plates, which are how the thing was measured. */
function Blueprints({ model }: { model: ModelType }) {
  return (
    <section className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
      <Reveal className="mb-10 border-b border-edge pb-6">
        <p className="label mb-2">Orthographic</p>
        <h2 className="font-display text-[clamp(1.7rem,3.2vw,2.5rem)] font-semibold">
          Every proportion is a constant
        </h2>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-dim">{model.summary}</p>
      </Reveal>
      <div className={`grid gap-4 ${gridCols(model.plates.ortho.length)}`}>
        {model.plates.ortho.map((name, i) => (
          <Reveal key={name} delay={i * 80}>
            <figure className="overflow-hidden rounded-lg border border-edge bg-hull">
              <Plate slug={model.slug} name={name} alt={`${model.title}, ${PLATE_LABEL[name] ?? name} view`} className="w-full" />
              <figcaption className="label border-t border-edge px-4 py-3">
                {PLATE_LABEL[name] ?? name}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* Act 4 — the surface hardware, up close. */
function Details({ model }: { model: ModelType }) {
  return (
    <section className="border-t border-edge bg-hull/30">
      <div className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
        <Reveal className="mb-10">
          <p className="label mb-2">Surface</p>
          <h2 className="font-display text-[clamp(1.7rem,3.2vw,2.5rem)] font-semibold">Close up</h2>
        </Reveal>
        <div className={`grid gap-4 ${model.plates.detail.length === 3 ? 'sm:grid-cols-3' : gridCols(model.plates.detail.length)}`}>
          {model.plates.detail.map((name, i) => (
            <Reveal key={name} delay={i * 80}>
              <figure className="overflow-hidden rounded-lg border border-edge bg-void">
                <Plate slug={model.slug} name={name} alt={`${model.title}, ${PLATE_LABEL[name] ?? name} detail`} sizes="(min-width: 640px) 30vw, 92vw" className="w-full" />
                <figcaption className="label border-t border-edge px-4 py-3">
                  {PLATE_LABEL[name] ?? name}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* Act 5 — the numbers, then the files. */
function Closing({ model }: { model: ModelType }) {
  return (
    <section className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <Reveal>
          <p className="label mb-4">Specification</p>
          <SpecTable specs={model.specs} />
        </Reveal>
        <Reveal delay={100}>
          <DownloadPanel model={model} />
        </Reveal>
      </div>
    </section>
  )
}
