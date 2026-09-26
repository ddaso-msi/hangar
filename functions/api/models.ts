import type { Env } from './_lib'
import { methodNotAllowed } from './_lib'
import { json } from './_lib'

/** The catalogue, joined to its creator. Multi-creator reads from here unchanged. */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT m.slug, m.title, m.subtitle, m.summary, m.dims, m.tri_count, m.materials,
            m.hero_kind, m.price_cents, m.license, c.slug AS creator_slug, c.name AS creator_name
       FROM models m
       JOIN creators c ON c.id = m.creator_id
      WHERE m.status = 'published'
      ORDER BY m.sort_order`
  ).all()
  return json({ models: results })
}

export const onRequest = methodNotAllowed('GET')
