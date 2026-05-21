-- Per-domain snapshot of the most recent scan score, used by the daily
-- change-detection cron to decide when to fire a zephyr_score_changed event
-- to marketing-tools. We don't need full history here — the historical
-- archive lives in R2 (reports/{yyyy}/{mm}/{dd}/{id}.json).
CREATE TABLE IF NOT EXISTS scan_history (
  domain TEXT PRIMARY KEY,
  last_overall INTEGER NOT NULL,
  last_grade TEXT NOT NULL,
  last_critical_passed INTEGER NOT NULL DEFAULT 0,
  last_scanned_at TEXT NOT NULL
);
