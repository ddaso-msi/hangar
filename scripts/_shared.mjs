import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** SOURCE_ROOT is the workspace holding the Blender projects. Nothing under it is committed. */
export function sourceRoot() {
  const envFile = join(ROOT, '.env')
  let val = process.env.SOURCE_ROOT
  if (!val && existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(/^SOURCE_ROOT=(.*)$/m)
    if (m) val = m[1].trim()
  }
  if (!val) throw new Error('SOURCE_ROOT is not set. Copy .env.example to .env.')
  if (!existsSync(val)) throw new Error(`SOURCE_ROOT does not exist: ${val}`)
  return val
}

/**
 * One entry per model. `project` is the folder under SOURCE_ROOT.
 * A model with no `glb` ships as a cinematic page with no live inspector
 * until its bake/export pass has been run.
 */
export const MODELS = [
  {
    slug: 'starfighter',
    project: 'Starfighter',
    // The downloadable source: the baked scene plus the scripts that generated it.
    source: { blend: 'scenes/ship_baked.blend', include: ['scripts', 'README.md'] },
    textures: 'textures',
    glb: 'export/starfighter.glb',
    frames: { dir: 'renders/frames_final', fallback: 'renders/frames_preview', pattern: /^f_\d+\.png$/ },
    // Frame 0, as a standalone plate: the LCP image for the scrub. Identical to
    // the first frame the canvas draws, so the handoff from image to canvas is invisible.
    firstFrame: 'renders/frames_final/f_0001.png',
    poster: 'renders/fighter_hero.png',
    loop: 'renders/flythrough_preview.mp4',
    // The seam holds this exact frame, then dissolves into the live canvas.
    // `view` is the direction the inspector camera opens from (glTF: nose +X,
    // wings ±Z, up +Y); it must match the still or the swap is visible.
    seam: { still: 'renders/frames_final/f_0120.png', view: [-2.15, 0.42, 0.28], band: [0.42, 0.6], stars: true, contrast: 150 },
    stills: [
      ['top', 'renders/fighter_top.png'],
      ['front', 'renders/fighter_front.png'],
      ['profile', 'renders/fighter_profile.png'],
      ['rear', 'renders/fighter_rear.png'],
      ['detail-cockpit', 'renders/det_cockpit.png'],
      ['detail-exhaust', 'renders/det_exhaust.png'],
      ['detail-intake', 'renders/det_intake.png'],
    ],
  },
  {
    slug: 'tie-fighter',
    project: 'TieFighter',
    source: { blend: 'scenes/tie_baked.blend', include: ['scripts', 'README.md'] },
    textures: 'textures',
    glb: 'export/tie_fighter.glb',
    frames: null,
    poster: 'renders/tie_front.png',
    loop: null,
    seam: { still: 'renders/tie_front.png', view: [1, 0.001, 0], band: [0.2, 0.8], stars: false, contrast: 60 },
    stills: [
      ['front', 'renders/tie_front.png'],
      ['side', 'renders/tie_side.png'],
      ['top', 'renders/glb_top.png'],
      ['rear', 'renders/glb_rear.png'],
      ['detail-hub', 'renders/tie_hub.png'],
      ['detail-window', 'renders/tie_window.png'],
      ['detail-panel', 'renders/tie_panel.png'],
    ],
  },
  {
    slug: 'at-at',
    project: 'AT-AT',
    // No bake yet, so the unbaked scene and no texture set.
    source: { blend: 'scenes/atat.blend', include: ['scripts', 'README.md'] },
    textures: null,
    glb: null,
    frames: { dir: 'renders/walk', fallback: null, pattern: /^walk_\d+\.png$/ },
    firstFrame: 'renders/walk/walk_0000.png',
    poster: 'renders/atat.png',
    loop: 'renders/atat_walk.mp4',
    seam: null,
    stills: [
      ['front', 'renders/atat_front.png'],
      ['side', 'renders/atat_side.png'],
      ['top', 'renders/atat_top.png'],
      ['rear', 'renders/atat_rear.png'],
      ['detail-knee', 'renders/atat_knee.png'],
      ['detail-foot', 'renders/atat_foot.png'],
      ['detail-guns', 'renders/atat_guns.png'],
    ],
  },
  {
    slug: 'r2-d2',
    project: 'R2-D2',
    // Rigged (7 bones, 3 clips). No bake and none needed: every material is a
    // Principled BSDF with constant inputs, which glTF carries one to one.
    source: {
      blend: 'scenes/r2d2.blend',
      include: ['scripts', 'README.md'],
      clips: 3,
      // The committed FBX records the source .blend's absolute path; rebuild it
      // with the author's export script from a neutral path. r2d2_verify.py takes
      // the asset root and reads <root>/export, so the export goes there.
      exports: {
        script: 'scripts/r2d2_export.py',
        scene: 'scenes/r2d2.blend',
        verify: 'scripts/r2d2_verify.py',
        verifyRoot: true,
        stage: ['scenes', 'scripts'],
        files: ['r2d2.fbx', 'r2d2.glb'],
      },
    },
    textures: null,
    glb: 'export/r2d2.glb',
    // 145k tris of smooth sweeps, all geometry. 0.45 keeps the dome and barrel
    // round at 1.6 MB; the rig survives it (0 cross-bone triangles).
    web: { simplify: 0.45, quantize: true },
    frames: null,
    poster: 'renders/r2d2.png',
    loop: null,
    // No flythrough, so the seam is the hero render itself. It is portrait, so it
    // is shown at full viewport height (fit: 'height') rather than cropped, and
    // the inspector opens on the hero camera exactly as r2d2_views.py placed it
    // (Blender coordinates, converted to glTF by make-posters.mjs).
    seam: {
      still: 'renders/r2d2.png',
      view: [2.35, 0.42, 1.8],
      camera: { position: [2.35, -1.8, 1.0], target: [0, 0, 0.58], lens: 85, sensor: 36 },
      fit: 'height',
      // A lit studio, not space: the mid-grey backdrop would otherwise read as dark.
      lighting: 'studio',
      band: [0.03, 0.97],
      stars: false,
      contrast: 60,
    },
    stills: [
      ['front', 'renders/r2d2_front.png'],
      ['side', 'renders/r2d2_side.png'],
      ['rear', 'renders/r2d2_rear.png'],
      ['top', 'renders/r2d2_top.png'],
      ['detail-dome', 'renders/r2d2_dome.png'],
      ['detail-shoulder', 'renders/r2d2_shoulder.png'],
      ['detail-vents', 'renders/r2d2_vents.png'],
      ['detail-low', 'renders/r2d2_low.png'],
    ],
  },
  {
    slug: 'b1-battle-droid',
    project: 'BattleDroid',
    // Rigged and animated. `export` in the source zip carries the full-detail
    // .glb/.fbx with all 18 clips, the procedural .blend and HOW_TO_ANIMATE.md,
    // so the download is animatable outside Blender too.
    source: {
      blend: 'scenes/droid_baked.blend',
      include: ['scripts', 'README.md', 'export/HOW_TO_ANIMATE.md'],
      // Every clip is stashed on an NLA track so it survives the repackage; fail if not.
      clips: 18,
      // export/ is rebuilt, not copied: the committed FBX records absolute source
      // and texture paths. package-downloads.mjs re-runs the author's own export
      // script, unmodified, from a neutral path, checks it with the author's own
      // verifier, and ships these. The procedural .blend goes through the scene
      // sanitiser like every other .blend.
      exports: {
        script: 'scripts/droid_export.py',
        scene: 'scenes/droid_baked.blend',
        verify: 'scripts/droid_verify.py',
        stage: ['scenes', 'textures', 'scripts'],
        files: ['b1_battle_droid.fbx', 'b1_battle_droid.glb'],
        blend: 'b1_battle_droid.blend',
      },
    },
    textures: 'textures',
    glb: 'export/b1_battle_droid.glb',
    // 106k tris. Simplified to 25% and quantised for the inspector: measured
    // 1.66 MB through this pipeline, against 5.8 MB unchanged.
    web: { simplify: 0.25, quantize: true },
    frames: { dir: 'renders/walk', fallback: null, pattern: /^walk_\d+\.png$/ },
    // Two strides of the march, then B1_Stop, which ends on the rest pose the
    // GLB shows, with the floor faded to black over the last 12 frames -- so the
    // last frame is the seam, its corners are the inspector's black, and the
    // dissolve doesn't pop.
    firstFrame: 'renders/walk/walk_0000.png',
    poster: 'renders/droid.png',
    loop: 'renders/droid_walk.mp4',
    // The droid faces glTF +Z (a character, not a ship: engine convention).
    // `view` is the walk camera's direction from the model, in glTF axes.
    seam: { still: 'renders/walk/walk_0083.png', view: [-3.75, 0.02, 4.15], band: [0.05, 0.97], stars: false, contrast: 40 },
    stills: [
      ['front', 'renders/droid_front.png'],
      ['side', 'renders/droid_side.png'],
      ['top', 'renders/droid_top.png'],
      ['rear', 'renders/droid_rear.png'],
      ['detail-head', 'renders/droid_detail_head.png'],
      ['detail-pack', 'renders/droid_detail_pack.png'],
      ['detail-knee', 'renders/droid_detail_knee.png'],
    ],
  },
]

export const bytes = (n) =>
  n > 1 << 20 ? `${(n / (1 << 20)).toFixed(2)} MB` : `${(n / 1024).toFixed(0)} KB`
