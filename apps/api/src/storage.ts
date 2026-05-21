import type { Env } from "./env.js";

export interface StoredScan {
  id: string;
  target: string;
  scannedAt: string;
  meta: {
    apiVersion: string;
    checksCovered: number;
    checksTotal: number;
    limitedCoverage: boolean;
    cached: boolean;
    durationMs: number;
    disclaimer?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  score: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any[];
}

export async function readScanCache(
  env: Env,
  cacheKey: string,
): Promise<StoredScan | null> {
  if (!env.SCANS) return null;
  const raw = await env.SCANS.get(cacheKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredScan;
  } catch {
    return null;
  }
}

export async function writeScanCache(
  env: Env,
  cacheKey: string,
  scan: StoredScan,
  ttlSeconds: number,
): Promise<void> {
  if (!env.SCANS) return;
  await env.SCANS.put(cacheKey, JSON.stringify(scan), { expirationTtl: ttlSeconds });
}

export async function writeScanById(
  env: Env,
  scan: StoredScan,
  ttlSeconds: number,
): Promise<void> {
  if (!env.SCANS) return;
  await env.SCANS.put(`scan:${scan.id}`, JSON.stringify(scan), {
    expirationTtl: ttlSeconds * 24 * 7, // ~1 week
  });
}

export async function readScanById(
  env: Env,
  id: string,
): Promise<StoredScan | null> {
  if (!env.SCANS) return null;
  const raw = await env.SCANS.get(`scan:${id}`);
  return raw ? (JSON.parse(raw) as StoredScan) : null;
}

export async function writeReportToR2(
  env: Env,
  scan: StoredScan,
): Promise<void> {
  if (!env.REPORTS) return;
  const d = new Date(scan.scannedAt);
  const key = `reports/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${scan.id}.json`;
  await env.REPORTS.put(key, JSON.stringify(scan, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
}

export async function readOgPng(env: Env, id: string): Promise<ArrayBuffer | null> {
  if (!env.REPORTS) return null;
  const obj = await env.REPORTS.get(`og/${id}.png`);
  if (!obj) return null;
  return obj.arrayBuffer();
}

export async function writeOgPng(
  env: Env,
  id: string,
  bytes: ArrayBuffer | Uint8Array,
): Promise<void> {
  if (!env.REPORTS) return;
  await env.REPORTS.put(`og/${id}.png`, bytes, {
    httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
  });
}

interface CategoryScore {
  category: string;
  score: number;
}

interface ScoreShape {
  overall: number;
  grade: string;
  categories?: CategoryScore[];
}

function catScore(score: ScoreShape, name: string): number {
  return score.categories?.find((c) => c.category === name)?.score ?? 0;
}

export async function writeScanRow(env: Env, scan: StoredScan): Promise<void> {
  if (!env.DB) return;
  const score = scan.score as ScoreShape;
  const domain = new URL(scan.target).hostname;
  await env.DB.prepare(
    `INSERT INTO scans (id, domain, target_url, overall, grade,
      category_commerce, category_product_data, category_checkout,
      category_discoverability, category_content, scanned_at, hidden)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  )
    .bind(
      scan.id,
      domain,
      scan.target,
      score.overall,
      score.grade,
      catScore(score, "commerce"),
      catScore(score, "product-data"),
      catScore(score, "checkout"),
      catScore(score, "discoverability"),
      catScore(score, "content"),
      scan.scannedAt,
    )
    .run();
}

export async function latestScanForDomain(
  env: Env,
  domain: string,
): Promise<StoredScan | null> {
  if (!env.DB) return null;
  const row = await env.DB.prepare(
    `SELECT id FROM scans WHERE domain = ? AND hidden = 0 ORDER BY scanned_at DESC LIMIT 1`,
  )
    .bind(domain.toLowerCase())
    .first<{ id: string }>();
  return row ? readScanById(env, row.id) : null;
}

export interface LeaderboardEntry {
  rank: number;
  domain: string;
  score: number;
  grade: string;
  scannedAt: string;
}

export async function leaderboardEntries(
  env: Env,
  options: { period: "7d" | "30d" | "all"; category?: string; limit: number },
): Promise<LeaderboardEntry[]> {
  if (!env.DB) return [];
  const limit = Math.min(Math.max(options.limit, 1), 100);
  const since =
    options.period === "all"
      ? null
      : new Date(Date.now() - (options.period === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString();

  const orderBy = options.category ? categoryColumn(options.category) : "overall";
  if (!orderBy) return [];

  const sql = `
    SELECT s.* FROM scans s
    JOIN (
      SELECT domain, MAX(scanned_at) AS latest
      FROM scans WHERE hidden = 0 ${since ? "AND scanned_at >= ?" : ""}
      GROUP BY domain
    ) latest ON latest.domain = s.domain AND latest.latest = s.scanned_at
    ORDER BY s.${orderBy} DESC, s.scanned_at DESC
    LIMIT ?`;
  const stmt = since
    ? env.DB.prepare(sql).bind(since, limit)
    : env.DB.prepare(sql).bind(limit);
  const { results } = await stmt.all<{
    domain: string;
    overall: number;
    grade: string;
    scanned_at: string;
  }>();
  return results.map((r, i) => ({
    rank: i + 1,
    domain: r.domain,
    score: r.overall,
    grade: r.grade,
    scannedAt: r.scanned_at,
  }));
}

const ALLOWED_CATEGORIES = new Set([
  "commerce",
  "product-data",
  "checkout",
  "discoverability",
  "content",
]);

function categoryColumn(category: string): string | null {
  if (!ALLOWED_CATEGORIES.has(category)) return null;
  return `category_${category.replace("-", "_")}`;
}
