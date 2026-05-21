CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  target_url TEXT NOT NULL,
  overall INTEGER NOT NULL,
  grade TEXT NOT NULL,
  category_commerce INTEGER NOT NULL DEFAULT 0,
  category_product_data INTEGER NOT NULL DEFAULT 0,
  category_checkout INTEGER NOT NULL DEFAULT 0,
  category_discoverability INTEGER NOT NULL DEFAULT 0,
  category_content INTEGER NOT NULL DEFAULT 0,
  scanned_at TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_scans_domain ON scans(domain);
CREATE INDEX IF NOT EXISTS idx_scans_overall ON scans(overall DESC) WHERE hidden = 0;
CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON scans(scanned_at DESC);
