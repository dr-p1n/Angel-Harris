-- Angel Harris portfolio: initial schema.
-- Apply with: npx wrangler d1 migrations apply DB (see README).

CREATE TABLE projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  title       TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT '',
  summary     TEXT    NOT NULL DEFAULT '',
  body        TEXT    NOT NULL DEFAULT '',
  year        TEXT    NOT NULL DEFAULT '',
  client      TEXT    NOT NULL DEFAULT '',
  role        TEXT    NOT NULL DEFAULT '',
  tags        TEXT    NOT NULL DEFAULT '',
  cover_url   TEXT    NOT NULL DEFAULT '',
  featured    INTEGER NOT NULL DEFAULT 0,
  published   INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_projects_pub_pos ON projects (published, position);

CREATE TABLE project_media (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL CHECK (kind IN ('image', 'embed')),
  url         TEXT    NOT NULL,
  caption     TEXT    NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_media_project ON project_media (project_id, position);

CREATE TABLE services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  details     TEXT    NOT NULL DEFAULT '',
  published   INTEGER NOT NULL DEFAULT 1,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- Neutral defaults only. Personal details (email, socials, bio) are entered
-- by Angel in the admin portal, never stored in the repo.
INSERT INTO settings (key, value) VALUES
  ('tagline',    'Brand, development and design.'),
  ('about',      ''),
  ('location',   ''),
  ('email',      ''),
  ('instagram',  ''),
  ('behance',    ''),
  ('linkedin',   ''),
  ('categories', '[{"slug":"brand","label":"Brand"},{"slug":"development","label":"Development"},{"slug":"design","label":"Design"}]');
