-- R2-D2, added from 3d-asset-marketplace (eae3c39). Renders and source only:
-- materials are procedural, so there is no bake and no web GLB yet.
UPDATE models SET sort_order = 5 WHERE slug = 'car';

INSERT INTO models (slug, title, subtitle, creator_id, summary, dims, tri_count, materials, hero_kind, status, sort_order) VALUES
  ('r2-d2', 'R2-D2', 'Astromech droid',
   (SELECT id FROM creators WHERE slug='deb'),
   'The whole droid lives on two surfaces: a cylinder and a flattened hemisphere. Every panel, stripe, vent and logic display is a real volume standing proud of one of them. No decals, no booleans, no modifiers.',
   '1.09 m tall x 0.467 m barrel', NULL, NULL, 'sequence', 'published', 4);
