-- Project workspace (ongoing client work) and internal operations (tasks).

-- Existing rows are portfolio pieces, so they default to 'completed'.
ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'; -- ongoing | on_hold | completed
ALTER TABLE projects ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;      -- 0-100, used when there are no milestones
ALTER TABLE projects ADD COLUMN due_date TEXT NOT NULL DEFAULT '';        -- YYYY-MM-DD or ''
ALTER TABLE projects ADD COLUMN share_token TEXT;                         -- private client link, NULL = disabled
CREATE UNIQUE INDEX idx_projects_share ON projects (share_token) WHERE share_token IS NOT NULL;

CREATE TABLE milestones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title           TEXT    NOT NULL,
  due_date        TEXT    NOT NULL DEFAULT '',
  done            INTEGER NOT NULL DEFAULT 0,
  client_visible  INTEGER NOT NULL DEFAULT 1,
  position        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_milestones_project ON milestones (project_id, position);

CREATE TABLE deliverables (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title           TEXT    NOT NULL,
  description     TEXT    NOT NULL DEFAULT '',
  url             TEXT    NOT NULL DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'pending',                       -- pending | delivered | approved
  client_visible  INTEGER NOT NULL DEFAULT 1,
  position        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_deliverables_project ON deliverables (project_id, position);

CREATE TABLE project_updates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  body            TEXT    NOT NULL,
  client_visible  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_updates_project ON project_updates (project_id, id);

CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  notes       TEXT    NOT NULL DEFAULT '',
  priority    TEXT    NOT NULL DEFAULT 'normal',   -- urgent | high | normal | low
  status      TEXT    NOT NULL DEFAULT 'todo',     -- todo | doing | done
  due_date    TEXT    NOT NULL DEFAULT '',         -- YYYY-MM-DD or ''
  recurrence  TEXT    NOT NULL DEFAULT 'none',     -- none | daily | weekly | monthly | yearly
  project_id  INTEGER REFERENCES projects (id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  done_at     TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX idx_tasks_status_due ON tasks (status, due_date);
