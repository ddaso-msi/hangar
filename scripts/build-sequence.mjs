/**
 * Cycles frame sequence -> scroll-scrubbable AVIF/WebP ladder.
 *
 * The hero is a pre-rendered sequence rather than live WebGL because these frames
 * are already photoreal in a way a 60fps canvas cannot match. Scroll drives the
 * frame index; the browser only ever decodes images.
 *
 * Two tiers are emitted:
 *   desktop  - full width, every frame
 *   mobile   - half width, every 2nd frame (half the bytes, half the decodes)
 *
 * No ffmpeg required: this is an image sequence, not a video encode.
 */
import { readdirSync, mkdirSync, rmSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { ROOT, sourceRoot, MODELS, bytes } from './_shared.mjs'

const TIERS = [
  { name: 'desktop', width: 900, step: 1, quality: 52 },
  { name: 'mobile', width: 480, step: 2, quality: 46 },
]

const only = process.argv[2]

for (const model of MODELS) {
  if (only && model.slug !== only) continue
  if (!model.frames) {
    console.log(`- ${model.slug}: no frame sequence, skipping`)
    continue
  }

  const base = join(sourceRoot(), model.project)
  let dir = join(base, model.frames.dir)
  let files
  try {
    files = readdirSync(dir).filter((f) => model.frames.pattern.test(f)).sort()
  } catch {
    files = []
  }
  if (!files.length && model.frames.fallback) {
    dir = join(base, model.frames.fallback)
    files = readdirSync(dir).filter((f) => model.frames.pattern.test(f)).sort()
  }
  if (!files.length) {
    console.log(`- ${model.slug}: no frames found under ${dir}`)
    continue
  }

  const meta = await sharp(join(dir, files[0])).metadata()
  console.log(`\n${model.slug}: ${files.length} frames, ${meta.width}x${meta.height} source`)

  const manifest = { slug: model.slug, aspect: +(meta.width / meta.height).toFixed(4), tiers: {} }

  for (const tier of TIERS) {
    const outDir = join(ROOT, 'public/assets/seq', model.slug, tier.name)
    rmSync(outDir, { recursive: true, force: true })
    mkdirSync(outDir, { recursive: true })

    const picked = files.filter((_, i) => i % tier.step === 0)
    let total = 0
    await Promise.all(
      picked.map(async (f, i) => {
        const out = join(outDir, `${String(i).padStart(4, '0')}.avif`)
        await sharp(join(dir, f))
          .resize({ width: tier.width, withoutEnlargement: true })
          .avif({ quality: tier.quality, effort: 4 })
          .toFile(out)
        total += statSync(out).size
      })
    )
    manifest.tiers[tier.name] = { count: picked.length, width: tier.width, bytes: total }
    console.log(
      `  ${tier.name.padEnd(8)} ${String(picked.length).padStart(3)} frames  ` +
        `${bytes(total).padStart(9)}  (${bytes(total / picked.length)}/frame)`
    )
  }

  const mf = join(ROOT, 'public/assets/seq', model.slug, 'manifest.json')
  writeFileSync(mf, JSON.stringify(manifest, null, 2))
  console.log(`  manifest -> ${mf.replace(ROOT + '/', '')}`)
}
