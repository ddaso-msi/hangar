import { Link } from 'react-router'

export function Footer() {
  return (
    <footer className="border-t border-edge">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="font-display text-[15px] font-semibold">Hangar</p>
          <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-faint">
            Fan work, built in Blender and shared for study and personal projects. Not affiliated
            with or endorsed by any rights holder. Nothing here is for sale.
          </p>
        </div>
        <div className="flex gap-5">
          <Link to="/models" className="label hover:text-dim">Models</Link>
          <Link to="/process" className="label hover:text-dim">Process</Link>
        </div>
      </div>
    </footer>
  )
}
