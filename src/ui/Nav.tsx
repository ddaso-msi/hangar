import { Link, NavLink } from 'react-router'

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-edge/60 bg-void/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-5 py-3.5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5 font-display text-[15px] font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded-sm border border-ember/50 text-ember">
            <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
              <path d="M8 1 15 8l-7 7-7-7z" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </span>
          Hangar
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Item to="/models">Models</Item>
          <Item to="/process">Process</Item>
          <a
            href="/models"
            className="ml-1 hidden rounded-full bg-ink px-3.5 py-1.5 sm:inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-void transition hover:bg-ember"
          >
            Free downloads
          </a>
        </div>
      </nav>
    </header>
  )
}

function Item({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition ${
          isActive ? 'text-ink' : 'text-faint hover:text-dim'
        }`
      }
    >
      {children}
    </NavLink>
  )
}
