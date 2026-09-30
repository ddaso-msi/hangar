-- R2-D2 is now rigged and exported (3d-asset-marketplace 8f83746): a GLB with
-- constant Principled materials needs no bake, so it gets the live inspector.
UPDATE models
   SET hero_kind = 'live',
       tri_count = 145314,
       materials = 12,
       subtitle  = 'Astromech droid, 3 animation clips'
 WHERE slug = 'r2-d2';
