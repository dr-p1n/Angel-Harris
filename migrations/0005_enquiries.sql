-- Animation enquiries from the Get a quote page (3D print requests live in `quotes`).

CREATE TABLE enquiries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ref          TEXT NOT NULL UNIQUE,            -- random reference, e.g. AH-7K4M2Q (never sequential)
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  project_type TEXT NOT NULL,                   -- short film, game animation, ...
  scope        TEXT NOT NULL DEFAULT '',        -- rough length or amount of work
  deadline     TEXT NOT NULL DEFAULT '',
  budget       TEXT NOT NULL DEFAULT '',
  link         TEXT NOT NULL DEFAULT '',        -- optional reference or brief link
  notes        TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'quoted', 'accepted', 'declined')),
  ip_hash      TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_enquiries_created ON enquiries(created_at);
