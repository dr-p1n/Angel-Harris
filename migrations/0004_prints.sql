-- 3D print quote requests, plus defaults that match the new site structure.

CREATE TABLE quotes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ref        TEXT NOT NULL UNIQUE,            -- random quote number, e.g. AH-7K4M2Q (never sequential)
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  material   TEXT NOT NULL,
  finish     TEXT NOT NULL DEFAULT '',
  size       TEXT NOT NULL,                   -- "L x W x H mm"
  qty        INTEGER NOT NULL,
  rush       INTEGER NOT NULL DEFAULT 0,
  notes      TEXT NOT NULL DEFAULT '',
  file_url   TEXT NOT NULL DEFAULT '',        -- optional link to the 3D file
  est_low    INTEGER NOT NULL,
  est_high   INTEGER NOT NULL,
  details    TEXT NOT NULL DEFAULT '{}',      -- JSON: the full estimate as it was shown
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'quoted', 'accepted', 'declined')),
  ip_hash    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_quotes_created ON quotes(created_at);

-- Only replace the placeholder defaults from 0001; anything Angel has edited stays.
UPDATE settings
   SET value = '[{"slug":"animation","label":"Digital animation"},{"slug":"prints","label":"3D prints"}]'
 WHERE key = 'categories'
   AND value = '[{"slug":"brand","label":"Brand"},{"slug":"development","label":"Development"},{"slug":"design","label":"Design"}]';
UPDATE settings SET value = 'Animation, games and small printed things.' WHERE key = 'tagline' AND value = 'Brand, development and design.';
