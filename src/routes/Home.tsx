import { Link } from 'react-router'
import { MODELS } from '../lib/catalog'
import { FrameSequence } from '../scroll/FrameSequence'
import { ModelCard } from '../ui/ModelCard'
import { Reveal } from '../ui/Reveal'

export default function Home() {
  return (
    <>
      {/* The flythrough is a 9:16 vertical climb, so it fills a phone edge to edge
          and sits as a tall centre panel on desktop with the copy beside it. */}
      <FrameSequence slug="starfighter" vh={340}>
        <div className="pointer-events-none absolute inset-0 mx-auto flex max-w-[1400px] flex-col justify-end px-5 pb-16 sm:px-8 lg:justify-center lg:pb-0">
          <div className="max-w-xl">
            <p className="label mb-4">Free 3D models · built in Blender</p>
            <h1 className="font-display text-[clamp(2.6rem,7vw,5.5rem)] font-bold leading-[0.95]">
              Ships measured,
              <br />
              not sculpted.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-dim">
              Every model here is generated from a table of ratios taken off a blueprint, baked
              game-ready, and given away. Walk around them in the browser, then take the files.
            </p>
            <div className="pointer-events-auto mt-7 flex flex-wrap gap-3">
              <Link
                to="/models"
                className="rounded-full bg-ink px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-void transition hover:bg-ember"
              >
                Browse models
              </Link>
              <Link
                to="/process"
                className="rounded-full border border-edge px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink backdrop-blur transition hover:border-ember hover:text-ember"
              >
                How they are built
              </Link>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 lg:block">
          <p className="label animate-pulse">scroll</p>
        </div>
      </FrameSequence>

      <Catalogue />
      <ProcessTeaser />
    </>
  )
}

function Catalogue() {
  return (
    <section id="models" className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
      <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-6">
        <div>
          <p className="label mb-2">The hangar</p>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.75rem)] font-semibold">
            {MODELS.length} models, all free
          </h2>
        </div>
        <p className="max-w-sm text-[13px] leading-relaxed text-dim">
          Two ship with a live inspector you can orbit. The rest are finished geometry waiting on
          a texture bake — the source files are here either way.
        </p>
      </Reveal>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {MODELS.map((m, i) => (
          <Reveal as="li" key={m.slug} delay={i * 70}>
            <ModelCard model={m} />
          </Reveal>
        ))}
      </ul>
    </section>
  )
}

function ProcessTeaser() {
  return (
    <section className="border-t border-edge bg-hull/40">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <p className="label mb-3">Process</p>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.75rem)] font-semibold leading-tight">
            No one sculpted these.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-dim">
            Each ship is a Python script. Proportions live at the top of the file as named
            constants in metres, geometry is assembled from those constants, and the build prints
            its measured bounding box every run so an edit cannot quietly change the silhouette.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-dim">
            The interesting part is what broke along the way — a smoothing operator that silently
            does nothing in headless mode, a bake pass that darkens every metallic surface, glass
            that bakes fully opaque and hides the cockpit.
          </p>
          <Link
            to="/process"
            className="mt-7 inline-block rounded-full border border-edge px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition hover:border-ember hover:text-ember"
          >
            Read the build notes
          </Link>
        </Reveal>
        <Reveal delay={120}>
          <pre className="overflow-x-auto rounded-lg border border-edge bg-void p-5 font-mono text-[11.5px] leading-relaxed text-dim">
{`| feature              | blueprint | constant   |
|----------------------|-----------|------------|
| length : span        | 1.14 : 1  | NOSE/TAIL  |
| nose (tip → canopy)  | 45%       | CANOPY_F   |
| canopy               | 14%       | CANOPY_R   |
| engine front         | 62% aft   | ENGINE_X   |
| cannon muzzle        | 29% aft   | quadrant() |`}
          </pre>
        </Reveal>
      </div>
    </section>
  )
}
