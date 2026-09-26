export interface Env {
  DB: D1Database
  FILES: R2Bucket
  SIGNING_KEY: string
  DOWNLOAD_TTL_SECONDS?: string
  REQUIRE_EMAIL?: string
}

const enc = new TextEncoder()
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64url = (s: string) =>
  atob(s.replace(/-/g, '+').replace(/_/g, '/'))

async function key(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** A short-lived capability URL for one R2 object. Nothing else grants access. */
export async function sign(secret: string, payload: object) {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const mac = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body))
  return `${body}.${b64url(mac)}`
}

export async function verify(secret: string, token: string): Promise<{ k: string; n: string; exp: number } | null> {
  const [body, mac] = token.split('.')
  if (!body || !mac) return null
  const raw = Uint8Array.from(unb64url(mac), (c) => c.charCodeAt(0))
  const ok = await crypto.subtle.verify('HMAC', await key(secret), raw, enc.encode(body))
  if (!ok) return null
  try {
    const claims = JSON.parse(unb64url(body))
    if (typeof claims.exp !== 'number' || claims.exp < Date.now() / 1000) return null
    return claims
  } catch {
    return null
  }
}

/** Coarse, salted, non-reversible. Enough to count unique grabs, not to identify anyone. */
export async function hashIp(ip: string, salt: string) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${ip}`))
  return b64url(digest).slice(0, 22)
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

/**
 * Pages falls through to the SPA's index.html for any method a Function does not
 * handle, which would answer a wrong-method API call with an HTML page and a 200.
 * Each endpoint exports this as its generic onRequest, so method-specific
 * handlers still win and everything else gets an honest 405.
 */
export const methodNotAllowed =
  (...allow: string[]): PagesFunction =>
  () =>
    new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', allow: allow.join(', ') },
    })
