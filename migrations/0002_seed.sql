INSERT INTO creators (slug, name, bio) VALUES
  ('deb', 'Deb', 'Builds spacecraft in Blender the way you''d build software: procedurally, from ratio constants measured off blueprints, with a guard line printed on every build so the silhouette can''t quietly drift.');

-- Figures come from each project's README, not from guesses.
INSERT INTO models (slug, title, subtitle, creator_id, summary, dims, tri_count, materials, hero_kind, status, sort_order) VALUES
  ('starfighter', 'Starfighter', 'Four-wing atmospheric interceptor',
   (SELECT id FROM creators WHERE slug='deb'),
   'Built procedurally from the blueprint''s top view by ratio, not by its annotations. Nose tip to exhaust is 100% of length; every feature is a fraction of that. The build prints its measured bounding box each run, so geometry edits cannot quietly drift the silhouette.',
   '13.0 x 11.4 x 5.1 m', 24432, 3, 'live', 'published', 1),

  ('tie-fighter', 'TIE Fighter', 'Twin ion engine escort',
   (SELECT id FROM creators WHERE slug='deb'),
   'Wing height is the unit: every proportion derives from it, and tie.py prints a guard line on every build. Four materials including a genuine transmissive canopy, which survives the bake only because the glass is rebuilt after baking rather than baked flat.',
   '7.50 x 6.15 x 4.30 m', 15864, 4, 'live', 'published', 2),

  ('at-at', 'AT-AT', 'Four-legged armoured transport',
   (SELECT id FROM creators WHERE slug='deb'),
   'Twenty metres long, twenty-two and a half tall, built from three primitives: a prism, a tube, and a tapered strut. A leg is described only as hip, knee, ankle, foot -- move one of those points and the thigh, shin, knee housing and ribs all follow.',
   '20.0 x 22.5 m', NULL, NULL, 'sequence', 'published', 3),

  ('car', 'Turntable Study', 'Studio lighting and surfacing test',
   (SELECT id FROM creators WHERE slug='deb'),
   'A surfacing and three-point studio lighting study, rendered as a turntable.',
   NULL, NULL, NULL, 'sequence', 'draft', 4);
