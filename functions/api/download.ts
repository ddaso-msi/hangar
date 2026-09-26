import type { Env } from './_lib'
import { methodNotAllowed } from './_lib'
import { sign, hashIp, json } from './_lib'

interface ModelRow { id: number; slug: string; title: string; price_cents: number }
interface AssetRow { id: number; kind: string; format: string; r2_key: string; bytes: number }

/**
 * Every download goes through here, free or not, so the catalogue has a real
 * record of what people take. Paid formats are a price check in this one place
 * rather than a different code path.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const slug = url.searchParams.get('model')
  const kind = url.searchParams.get('kind')
  if (!slug || !kind) return json({ error: 'model and kind are required' }, 400)

  const model = await env.DB.prepare(
    `SELECT id, slug, title, price_cents FROM models WHERE slug = ? AND status = 'published'`
  ).bind(slug).first<ModelRow>()
  if (!model) return json({ error: 'not found' }, 404)

  const asset = await env.DB.prepare(
    `SELECT id, kind, format, r2_key, bytes FROM model_assets WHERE model_id = ? AND kind = ?`
  ).bind(model.id, kind).first<AssetRow>()
  if (!asset) return json({ error: 'no such format for this model' }, 404)

  // The seam for paid downloads later: everything else here already works.
  if (model.price_cents > 0) {
    return json({ error: 'payment required', priceCents: model.price_cents }, 402)
  }

  let email: string | null = null
  if (env.REQUIRE_EMAIL === 'true') {
    const body = await request.json<{ email?: string }>().catch((): { email?: string } => ({}))
    email = body.email?.trim() ?? null
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: 'email required' }, 422)
    }
  }

  const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0'
  await env.DB.prepare(
    `INSERT INTO downloads (model_id, asset_id, email, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?)`
  ).bind(
    model.id, asset.id, email,
    await hashIp(ip, env.SIGNING_KEY),
    (request.headers.get('user-agent') ?? '').slice(0, 250)
  ).run()

  // The web GLB is already public — it is what the on-page inspector loads, so
  // putting it behind a signed URL would only be theatre.
  if (asset.kind === 'web_glb') {
    return json({ url: `/assets/models/${model.slug}.glb` })
  }

  const ttl = Number(env.DOWNLOAD_TTL_SECONDS ?? 300)
  const token = await sign(env.SIGNING_KEY, {
    k: asset.r2_key,
    n: `${model.slug}-${asset.kind}.${asset.format}`,
    exp: Math.floor(Date.now() / 1000) + ttl,
  })
  return json({ url: `/api/file?t=${encodeURIComponent(token)}`, expiresIn: ttl })
}

export const onRequest = methodNotAllowed('POST')
