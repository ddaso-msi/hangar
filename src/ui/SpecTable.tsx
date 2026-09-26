export function SpecTable({ specs }: { specs: [string, string][] }) {
  return (
    <dl className="divide-y divide-edge border-y border-edge">
      {specs.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-6 py-3">
          <dt className="label">{k}</dt>
          <dd className="text-right font-mono text-[13px] text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
