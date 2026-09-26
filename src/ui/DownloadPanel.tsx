import { useState } from 'react'
import type { Model } from '../lib/catalog'
import { prettyBytes } from '../lib/catalog'

/**
 * Everything is free. The request still goes through /api/download so each grab
 * is logged and so turning a format paid later is a check in that function
 * rather than a change here.
 */
export function DownloadPanel({ model }: { model: Model }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function grab(kind: string) {
    setBusy(kind)
    setError(null)
    try {
      const res = await fetch(`/api/download?model=${model.slug}&kind=${kind}`, { method: 'POST' })
      if (!res.ok) throw new Error(String(res.status))
      const { url } = (await res.json()) as { url: string }
      window.location.href = url
    } catch {
      // `vite dev` serves the static build without Pages Functions. The web GLB
      // is a public file either way, so it still works; the R2-backed formats
      // genuinely need `npm run dev:cf`.
      if (kind === 'web_glb') {
        window.location.href = `/assets/models/${model.slug}.glb`
      } else {
        setError('Source files are served from R2 — run the site with Functions to fetch them.')
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-edge bg-hull">
      <div className="flex items-baseline justify-between border-b border-edge px-5 py-4">
        <h2 className="font-display text-lg font-semibold">Download</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ember">Free</span>
      </div>

      <ul className="divide-y divide-edge">
        {model.downloads.map((d) => (
          <li key={d.kind} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-baseline gap-2">
                <span className="font-display text-[15px] font-semibold">{d.label}</span>
                <span className="font-mono text-[11px] text-faint">
                  .{d.format} · {prettyBytes(d.approxBytes)}
                </span>
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-dim">{d.note}</p>
            </div>
            <button
              onClick={() => grab(d.kind)}
              disabled={busy === d.kind}
              className="shrink-0 rounded-full border border-edge px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition hover:border-ember hover:text-ember disabled:opacity-50"
            >
              {busy === d.kind ? 'Preparing…' : 'Get'}
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="px-5 pb-4 font-mono text-[11px] text-stripe">{error}</p>}

      <p className="border-t border-edge px-5 py-4 text-[12px] leading-relaxed text-faint">
        Fan work, shared for study and personal projects. Not affiliated with or endorsed by
        any rights holder, and not for sale.
      </p>
    </div>
  )
}
