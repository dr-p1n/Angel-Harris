-- Contact-form messages, read in the admin portal.
CREATE TABLE messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  message     TEXT    NOT NULL,
  ip_hash     TEXT    NOT NULL DEFAULT '', -- salted hash, used only for rate limiting
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_messages_created ON messages (created_at);
CREATE INDEX idx_messages_ip ON messages (ip_hash, created_at);
