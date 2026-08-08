CREATE TABLE IF NOT EXISTS editorial_revision_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  title_ka TEXT NOT NULL,
  summary_ka TEXT NOT NULL,
  editorial_status TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(article_id) REFERENCES articles(id),
  UNIQUE(article_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_editorial_revision_snapshots_article
ON editorial_revision_snapshots(article_id, revision DESC);

