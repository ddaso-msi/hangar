import { MODELS } from '../lib/catalog'
import { ModelCard } from '../ui/ModelCard'
import { Reveal } from '../ui/Reveal'

export default function Models() {
  return (
    <section className="mx-auto max-w-[1400px] px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
      <Reveal className="mb-10 border-b border-edge pb-6">
        <p className="label mb-2">Catalogue</p>
        <h1 className="font-display text-[clamp(2.2rem,5vw,3.5rem)] font-semibold">All models</h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-dim">
          Free to download and use in personal work. Source scenes and texture sets are included
          alongside the web-ready GLB.
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
