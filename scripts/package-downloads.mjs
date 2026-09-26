/**
 * Package the downloadable files and register them.
 *
 *   node scripts/package-downloads.mjs                 # build zips + sizes only
 *   node scripts/package-downloads.mjs --push local    # ...and load into local R2 + D1
 *   node scripts/package-downloads.mjs --push remote   # ...and into production
 *
 * Source scenes and texture sets are large and go to R2, never into git. The web
 * GLB is already a public file (the inspector loads it), so it gets a catalogue
 * row but no upload. Byte sizes are measured here and written to
 * src/lib/downloads.generated.ts so the download panel never shows a guessed size.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, statSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname, basename } from 'node:path'
import { ROOT, sourceRoot, MODELS, bytes } from './_shared.mjs'

const pushIdx = process.argv.indexOf('--push')
const target = pushIdx > -1 ? process.argv[pushIdx + 1] : null
if (target && !['local', 'remote'].includes(target)) throw new Error('--push takes local or remote')

const OUT = join(ROOT, '.downloads')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16)
const sql = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)

const rows = []
const sizes = {}

const BLENDER = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender'

/**
 * Pack a scene for distribution (see scripts/blender/package_scene.py), then
 * refuse to ship it if any absolute home-directory path survived.
 */
function packageBlend(src, out) {
  const log = execFileSync(
    BLENDER,
    ['--background', '--factory-startup', '--python', join(ROOT, 'scripts/blender/package_scene.py'), '--', src, out],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  )
  const ok = log.match(/PACKAGE_OK images=(\d+) packed=(\d+) objects=(\d+)/)
  if (!ok) throw new Error(`Blender packaging failed for ${src}:\n${log.slice(-2000)}`)

  const leaks = [...new Set(readFileSync(out).toString('latin1').match(/\/Users\/[^\x00-\x1f"]{2,120}/g) ?? [])]
  if (leaks.length) throw new Error(`Refusing to ship ${basename(out)}: absolute paths remain:\n  ${leaks.join('\n  ')}`)
  if (+ok[1] !== +ok[2]) throw new Error(`${basename(out)}: only ${ok[2]} of ${ok[1]} images packed; it would open with missing textures`)
  return { images: +ok[1], packed: +ok[2], objects: +ok[3] }
}

function zip(outFile, cwd, entries) {
  // -X drops extra file attributes; -q quiet; -r recurse. Excludes editor cruft and Python caches.
  execFileSync('zip', ['-X', '-q', '-r', outFile, ...entries, '-x', '*.DS_Store', '*__pycache__*', '*.blend1'], { cwd })
}

for (const model of MODELS) {
  const base = join(sourceRoot(), model.project)
  sizes[model.slug] = {}

  // Web GLB: public already, just registered.
  const glb = join(ROOT, 'public/assets/models', `${model.slug}.glb`)
  if (existsSync(glb)) {
    const n = statSync(glb).size
    rows.push({ slug: model.slug, kind: 'web_glb', format: 'glb', label: 'Web GLB', key: `public/assets/models/${model.slug}.glb`, bytes: n, sum: sha(glb) })
    sizes[model.slug].web_glb = n
  }

  // Source: the .blend plus the scripts that generated it, zipped from the project root.
  if (model.source) {
    // Stage a clean copy: the packed, path-scrubbed scene plus the build scripts.
    const stage = join(OUT, `${model.slug}-source`)
    mkdirSync(join(stage, 'scenes'), { recursive: true })
    const blendOut = join(stage, 'scenes', basename(model.source.blend))
    const { images, packed, objects } = packageBlend(join(base, model.source.blend), blendOut)
    console.log(`  ${model.slug}: ${objects} objects, ${packed}/${images} images packed, no absolute paths`)
    for (const inc of model.source.include) {
      if (existsSync(join(base, inc))) execFileSync('cp', ['-R', join(base, inc), stage])
    }
    const file = join(OUT, `${model.slug}-source.zip`)
    zip(file, stage, ['.'])
    const n = statSync(file).size
    rows.push({ slug: model.slug, kind: 'source_blend', format: 'zip', label: 'Blender source', key: `models/${model.slug}/${basename(file)}`, bytes: n, sum: sha(file), file })
    sizes[model.slug].source_blend = n
  }

  if (model.textures && existsSync(join(base, model.textures))) {
    const file = join(OUT, `${model.slug}-textures.zip`)
    zip(file, base, [model.textures])
    const n = statSync(file).size
    rows.push({ slug: model.slug, kind: 'textures_zip', format: 'zip', label: 'Texture set', key: `models/${model.slug}/${basename(file)}`, bytes: n, sum: sha(file), file })
    sizes[model.slug].textures_zip = n
  }

  console.log(
    `${model.slug.padEnd(14)} ` +
      Object.entries(sizes[model.slug]).map(([k, n]) => `${k} ${bytes(n)}`).join('   ')
  )
}

writeFileSync(
  join(ROOT, 'src/lib/downloads.generated.ts'),
  `// Generated by scripts/package-downloads.mjs. Do not edit.\n` +
    `// Measured byte sizes of each downloadable file, by model and kind.\n` +
    `export const DOWNLOAD_BYTES: Record<string, Record<string, number>> = ${JSON.stringify(sizes, null, 2)}\n`
)

// Upsert, so re-running after a re-export just refreshes sizes and checksums.
const statements = rows.map(
  (r) =>
    `INSERT INTO model_assets (model_id, kind, format, label, r2_key, bytes, checksum)
     VALUES ((SELECT id FROM models WHERE slug = ${sql(r.slug)}), ${sql(r.kind)}, ${sql(r.format)}, ${sql(r.label)}, ${sql(r.key)}, ${r.bytes}, ${sql(r.sum)})
     ON CONFLICT (model_id, kind, format) DO UPDATE SET label = excluded.label, r2_key = excluded.r2_key, bytes = excluded.bytes, checksum = excluded.checksum;`
)
const sqlFile = join(OUT, 'assets.sql')
writeFileSync(sqlFile, statements.join('\n') + '\n')
console.log(`\n${rows.length} catalogue rows -> .downloads/assets.sql`)

if (target) {
  const flag = `--${target}`
  for (const r of rows.filter((r) => r.file)) {
    console.log(`  r2 put ${r.key} (${bytes(r.bytes)})`)
    execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `hangar-assets/${r.key}`, '--file', r.file, flag, ...(target === 'local' ? ['--persist-to', '.wrangler/state'] : [])], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] })
  }
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', flag, '--file', sqlFile, ...(target === 'local' ? ['--persist-to', '.wrangler/state'] : [])], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] })
  console.log(`pushed to ${target}`)
}
