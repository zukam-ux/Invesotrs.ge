ALTER TABLE articles ADD COLUMN editorial_status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE articles ADD COLUMN reviewed_by TEXT;
ALTER TABLE articles ADD COLUMN reviewed_at TEXT;
ALTER TABLE articles ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_articles_editorial_status
ON articles(editorial_status, published_at DESC);

CREATE TABLE IF NOT EXISTS editorial_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('approved', 'rejected')),
  reviewer_role TEXT NOT NULL,
  reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revision INTEGER NOT NULL,
  FOREIGN KEY(article_id) REFERENCES articles(id)
);

CREATE INDEX IF NOT EXISTS idx_editorial_reviews_article
ON editorial_reviews(article_id, reviewed_at DESC);
