-- B1 Battle Droid, added from 3d-asset-marketplace (f79c466, branch add-battle-droid).
-- Baked, with a web GLB and a walk sequence, so it gets the live inspector.
UPDATE models SET sort_order = 6 WHERE slug = 'car';

INSERT INTO models (slug, title, subtitle, creator_id, summary, dims, tri_count, materials, hero_kind, status, sort_order) VALUES
  ('b1-battle-droid', 'B1 Battle Droid', 'Rigged infantry droid, 18 animation clips',
   (SELECT id FROM creators WHERE slug='deb'),
   'Measured off a square-on side turnaround scaled to its 1.91 m height, by ratio. Every shell is a sweep of superellipse sections along a spine, and every limb hangs off six joint points that also place the bones. One rigidly skinned mesh, 42 bones, IK legs, and 18 clips that check themselves on every build.',
   '1.92 m tall x 0.52 m shoulders', 106103, 1, 'live', 'published', 5);
