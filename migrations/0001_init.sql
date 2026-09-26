-- Hangar catalogue.
--
-- creator_id and price_cents exist from the first migration on purpose: the site
-- ships as a single free storefront, but multi-creator and paid downloads are both
-- meant to be a route addition later rather than a schema change.

CREATE TABLE creators (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  bio        TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE models (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  subtitle    TEXT,
  creator_id  INTEGER NOT NULL REFERENCES creators(id),
  summary     TEXT,
  dims        TEXT,              -- human-readable, e.g. "13.0 x 11.4 x 5.1 m"
  tri_count   INTEGER,
  materials   INTEGER,
  -- 'live'     : cinematic sequence + WebGL inspector
  -- 'sequence' : cinematic sequence only (no baked GLB yet)
  hero_kind   TEXT NOT NULL DEFAULT 'sequence' CHECK (hero_kind IN ('live','sequence')),
  status      TEXT NOT NULL DEFAULT 'draft'    CHECK (status IN ('draft','published')),
  price_cents INTEGER NOT NULL DEFAULT 0,
  license     TEXT NOT NULL DEFAULT 'personal',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_models_status ON models(status, sort_order);

CREATE TABLE model_assets (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  -- web_glb | source_blend | textures_zip | frame_seq | stl
  kind     TEXT NOT NULL,
  format   TEXT NOT NULL,        -- glb | blend | zip | avif | stl
  label    TEXT NOT NULL,
  r2_key   TEXT NOT NULL,
  bytes    INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  UNIQUE (model_id, kind, format)
);
CREATE INDEX idx_assets_model ON model_assets(model_id);

CREATE TABLE downloads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id   INTEGER NOT NULL REFERENCES models(id),
  asset_id   INTEGER NOT NULL REFERENCES model_assets(id),
  email      TEXT,
  ip_hash    TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_downloads_model ON downloads(model_id, created_at);

CREATE TABLE subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
