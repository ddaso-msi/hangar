import type { Env } from './_lib'
import { methodNotAllowed } from './_lib'
import { verify } from './_lib'

/** Streams one R2 object, and only for an unexpired token this worker signed. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const token = new URL(request.url).searchParams.get('t')
  if (!token) return new Response('missing token', { status: 400 })

  const claims = await verify(env.SIGNING_KEY, token)
  if (!claims) return new Response('link expired', { status: 403 })

  const object = await env.FILES.get(claims.k)
  if (!object) return new Response('gone', { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('content-disposition', `attachment; filename="${claims.n}"`)
  headers.set('cache-control', 'private, no-store')
  headers.set('etag', object.httpEtag)
  return new Response(object.body, { headers })
}

export const onRequest = methodNotAllowed('GET')
