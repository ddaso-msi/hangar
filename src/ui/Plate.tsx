import { plateSrc, plateSrcSet } from '../lib/catalog'

/** A rendered plate from the Blender project, served as a responsive AVIF ladder. */
export function Plate({
  slug,
  name,
  alt,
  className = '',
  sizes = '(min-width: 1024px) 45vw, 90vw',
  priority = false,
}: {
  slug: string
  name: string
  alt: string
  className?: string
  sizes?: string
  priority?: boolean
}) {
  return (
    <img
      src={plateSrc(slug, name, 800)}
      srcSet={plateSrcSet(slug, name)}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={className}
    />
  )
}
