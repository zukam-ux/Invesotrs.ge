CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_ka TEXT NOT NULL,
  summary_ka TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  category TEXT NOT NULL,
  translation_notice TEXT NOT NULL DEFAULT 'AI-assisted Georgian translation',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_articles_published_at
ON articles(published_at DESC);
