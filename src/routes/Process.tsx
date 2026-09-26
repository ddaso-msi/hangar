import { Reveal } from '../ui/Reveal'

const GOTCHAS = [
  {
    title: 'shade_auto_smooth does nothing in background mode',
    body:
      'It needs the "Smooth by Angle" asset, which never finishes loading headlessly, so the operator returns CANCELLED without raising. Every curved surface stayed faceted and nothing reported an error. The fix was to write smooth and sharp flags straight onto the mesh with bmesh instead of calling the operator.',
  },
  {
    title: 'The diffuse bake is scaled by (1 − metallic)',
    body:
      'Worn metal edges and every metallic surface baked darker than their actual albedo. Base colour is now baked through an Emission swap, the same way metallic already was.',
  },
  {
    title: 'Transmission is not a bakeable channel',
    body:
      'A baked glass material exports fully opaque, which hid the cockpit entirely. The material is rebuilt after baking so the exporter maps it to KHR_materials_transmission instead.',
  },
  {
    title: 'The bake target must be the active node',
    body:
      'Not merely selected — active, in every material. Miss it in one and that material bakes into whichever texture happened to be active instead, silently.',
  },
]

export default function Process() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-28 pt-32 sm:px-8 sm:pt-40">
      <Reveal>
        <p className="label mb-3">Process</p>
        <h1 className="font-display text-[clamp(2.2rem,5vw,3.5rem)] font-semibold leading-tight">
          Ships measured, not sculpted
        </h1>
        <p className="mt-6 text-[16px] leading-relaxed text-dim">
          None of these models were modelled by hand. Each one is a Python script that assembles
          geometry from a table of named constants in metres, taken off a blueprint by ratio
          rather than from its annotations — which, on the Starfighter drawing, mix metres and
          centimetres and cannot be trusted.
        </p>
      </Reveal>

      <Reveal delay={80} className="mt-12">
        <h2 className="font-display text-xl font-semibold">Ratio, not vertices</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-dim">
          Nose tip to exhaust is 100% of length. Every other feature is a fraction of it, so the
          silhouette lives in a table rather than in a mesh. The build prints its measured
          bounding box on every run, which means a geometry edit that changes the shape shows up
          immediately instead of drifting quietly over a dozen commits.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-lg border border-edge bg-hull p-5 font-mono text-[11.5px] leading-relaxed text-dim">
{`| feature              | blueprint | constant   |
|----------------------|-----------|------------|
| length : span        | 1.14 : 1  | NOSE/TAIL  |
| nose (tip → canopy)  | 45%       | CANOPY_F   |
| canopy               | 14%       | CANOPY_R   |
| engine front         | 62% aft   | ENGINE_X   |
| cannon muzzle        | 29% aft   | quadrant() |`}
        </pre>
      </Reveal>

      <Reveal delay={80} className="mt-12">
        <h2 className="font-display text-xl font-semibold">Three primitives</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-dim">
          The AT-AT is built from a prism whose two ends can be scaled and shifted apart, a tube,
          and a tapered strut running between two joints. No modifiers, no booleans. A leg is
          described only as hip, knee, ankle and foot — move one of those four points and the
          thigh, shin, knee housing and shin ribs all follow.
        </p>
      </Reveal>

      <Reveal delay={80} className="mt-12">
        <h2 className="font-display text-xl font-semibold">What actually broke</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-dim">
          The pipeline is unwrap, bake, rebuild, export. Most of the time spent building it went
          on four failures that produce no error message at all.
        </p>
        <ol className="mt-6 space-y-5">
          {GOTCHAS.map((g, i) => (
            <li key={g.title} className="border-l-2 border-edge pl-5">
              <p className="flex gap-3 font-display text-[15px] font-semibold">
                <span className="font-mono text-[12px] text-ember">{String(i + 1).padStart(2, '0')}</span>
                {g.title}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-dim">{g.body}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal delay={80} className="mt-12 rounded-lg border border-edge bg-hull p-6">
        <h2 className="font-display text-lg font-semibold">On this site</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-dim">
          The cinematic passes are not WebGL. They are the actual Cycles frames, re-encoded to an
          AVIF ladder and scrubbed by scroll position, because a pre-rendered frame will beat a
          realtime one every time. The live canvas only takes over once you have arrived at the
          ship, and it loads a Meshopt-compressed GLB that is 78% smaller than the Blender export.
        </p>
      </Reveal>
    </div>
  )
}
