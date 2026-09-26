import { useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Model } from '../lib/catalog'
import { Plate } from './Plate'

/**
 * Grid card. The turntable mp4 already exists in each Blender project, so hover
 * plays the real render rather than a CSS approximation of motion. Video is only
 * attached on hover so a grid of cards costs nothing at rest.
 */
export function ModelCard({ model }: { model: Model }) {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const hasLoop = model.slug === 'starfighter' || model.slug === 'at-at'

  const enter = () => {
    if (!hasLoop) return
    setPlaying(true)
    video.current?.play().catch(() => setPlaying(false))
  }
  const leave = () => {
    setPlaying(false)
    video.current?.pause()
  }

  return (
    <Link
      to={`/models/${model.slug}`}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-edge bg-hull transition-colors duration-300 hover:border-faint"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-void">
        <Plate
          slug={model.slug}
          name="poster"
          alt={`${model.title} render`}
          sizes="(min-width: 1024px) 30vw, 92vw"
          className={`h-full w-full object-cover transition-all duration-700 group-hover:scale-[1.03] ${
            playing ? 'opacity-0' : 'opacity-100'
          }`}
        />
        {hasLoop && (
          <video
            ref={video}
            src={`/assets/loops/${model.slug}.mp4`}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              playing ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
        <span className="absolute left-3 top-3 rounded-full border border-edge bg-void/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-dim backdrop-blur">
          {model.heroKind === 'live' ? '3D inspector' : 'Renders only'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">{model.title}</h3>
          <span className="font-mono text-[11px] text-faint">Free</span>
        </div>
        <p className="text-[13px] text-dim">{model.subtitle}</p>
        <p className="mt-auto pt-3 font-mono text-[11px] text-faint">
          {model.dims ?? '—'}
          {model.triCount ? ` · ${model.triCount.toLocaleString()} tris` : ''}
        </p>
      </div>
    </Link>
  )
}
