/**
 * Daily change-detection cron.
 *
 * Wakes once per day, fetches the zephyr-alerts mailing list from
 * marketing.weaverse.io, re-scans each subscribed domain, diffs against the
 * scan_history table, and POSTs a `zephyr_score_changed` event to
 * marketing-tools when something material shifted. marketing-tools fires
 * the alert email via Resend (see src/lib/zephyr-handlers.ts there).
 *
 * "Material" = overall score moved ≥ 5 points OR a critical check flipped
 * pass↔fail. Below that threshold, we silently update scan_history and
 * move on — no email noise.
 */
import { allChecks, runAll, type CheckResult } from "@zephyr/checks";
import { scoreResults, type ScanScore } from "@zephyr/scoring";
import { listZephyrSubscribers, postZephyrEvent } from "./marketing.js";
import { USER_AGENT, type Env } from "./env.js";

const SCORE_DELTA_THRESHOLD = 5;
const CONCURRENCY = 5;

interface HistoryRow {
  last_overall: number;
  last_grade: string;
  last_critical_passed: number;
}

interface Diff {
  before: { overall: number; grade: string };
  after: { overall: number; grade: string };
  flippedChecks: string[];
  direction: "regression" | "improvement" | "flip";
}

async function readHistory(env: Env, domain: string): Promise<HistoryRow | null> {
  if (!env.DB) return null;
  return env.DB.prepare(
    `SELECT last_overall, last_grade, last_critical_passed
       FROM scan_history WHERE domain = ?`,
  )
    .bind(domain)
    .first<HistoryRow>();
}

async function writeHistory(
  env: Env,
  domain: string,
  score: ScanScore,
  criticalPassed: number,
): Promise<void> {
  if (!env.DB) return;
  await env.DB.prepare(
    `INSERT INTO scan_history (domain, last_overall, last_grade, last_critical_passed, last_scanned_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(domain) DO UPDATE SET
       last_overall = excluded.last_overall,
       last_grade = excluded.last_grade,
       last_critical_passed = excluded.last_critical_passed,
       last_scanned_at = excluded.last_scanned_at`,
  )
    .bind(domain, score.overall, score.grade, criticalPassed, new Date().toISOString())
    .run();
}

function criticalPassedCount(results: CheckResult[]): number {
  return results.filter((r) => r.severity === "critical" && r.passed).length;
}

function flippedCriticalChecks(
  prevPassed: number,
  results: CheckResult[],
): { names: string[]; direction: "regression" | "improvement" | null } {
  const currPassed = criticalPassedCount(results);
  if (currPassed === prevPassed) return { names: [], direction: null };
  // We don't store the *which* — just the count — so we can't surface which
  // individual check flipped vs only the magnitude. Surface the critical
  // check names that are currently failing so the alert email is still
  // useful. Future revision can persist per-check pass/fail.
  const failingCritical = results
    .filter((r) => r.severity === "critical" && !r.passed)
    .map((r) => r.name);
  return {
    names: failingCritical,
    direction: currPassed < prevPassed ? "regression" : "improvement",
  };
}

function computeDiff(
  history: HistoryRow,
  score: ScanScore,
  results: CheckResult[],
): Diff | null {
  const delta = score.overall - history.last_overall;
  const flip = flippedCriticalChecks(history.last_critical_passed, results);
  const flipDirection = flip.direction;
  const hasScoreShift = Math.abs(delta) >= SCORE_DELTA_THRESHOLD;
  if (!hasScoreShift && flip.names.length === 0) return null;

  const direction: Diff["direction"] = hasScoreShift
    ? delta < 0
      ? "regression"
      : "improvement"
    : flipDirection === "improvement"
      ? "improvement"
      : "flip";

  return {
    before: { overall: history.last_overall, grade: history.last_grade },
    after: { overall: score.overall, grade: score.grade },
    flippedChecks: flip.names,
    direction,
  };
}

function buildScanContext(target: URL) {
  return {
    url: target.toString(),
    origin: target.origin,
    fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...(init?.headers || {}) },
        cf: { cacheTtl: 60 },
      } as RequestInit)) as typeof fetch,
  };
}

async function processOne(
  env: Env,
  email: string,
  domain: string,
): Promise<{ status: "alerted" | "quiet" | "first-scan" | "error"; detail?: string }> {
  let target: URL;
  try {
    target = new URL(`https://${domain}`);
  } catch {
    return { status: "error", detail: "invalid domain" };
  }

  let results: CheckResult[];
  try {
    results = await runAll(buildScanContext(target));
  } catch (e) {
    return { status: "error", detail: `scan failed: ${(e as Error).message}` };
  }
  const score = scoreResults(results);
  const critPassed = criticalPassedCount(results);

  const history = await readHistory(env, domain);
  await writeHistory(env, domain, score, critPassed);

  if (!history) {
    // First time we've scanned this domain via the cron — record baseline,
    // don't alert (the subscriber just got the welcome email with the
    // current score; we'd be duplicating).
    return { status: "first-scan" };
  }

  const diff = computeDiff(history, score, results);
  if (!diff) return { status: "quiet" };

  try {
    await postZephyrEvent(env, {
      email,
      eventName: "zephyr_score_changed",
      properties: {
        domain,
        beforeScore: String(diff.before.overall),
        beforeGrade: diff.before.grade,
        afterScore: String(diff.after.overall),
        afterGrade: diff.after.grade,
        direction: diff.direction,
        flippedChecks: JSON.stringify(diff.flippedChecks),
      },
    });
    return { status: "alerted" };
  } catch (e) {
    return { status: "error", detail: `event post failed: ${(e as Error).message}` };
  }
}

/** Run the cron once. Exported for manual invocation (admin POST or local test). */
export async function runChangeDetection(env: Env): Promise<{
  total: number;
  alerted: number;
  quiet: number;
  firstScan: number;
  errors: number;
}> {
  const summary = { total: 0, alerted: 0, quiet: 0, firstScan: 0, errors: 0 };

  let subscribers: Array<{ email: string; shopDomain: string }> = [];
  try {
    subscribers = await listZephyrSubscribers(env);
  } catch (e) {
    console.error("[cron] failed to fetch subscribers:", (e as Error).message);
    return summary;
  }
  summary.total = subscribers.length;
  console.log(`[cron] processing ${subscribers.length} subscribers (checks: ${allChecks.length})`);

  // Process in chunks to bound concurrency — Worker has a 30s wall time per
  // request, scans take ~2s each, so 5 in parallel handles ~75 subs/run.
  // Past that we'd need to shard the cron or kick off in waitUntil.
  for (let i = 0; i < subscribers.length; i += CONCURRENCY) {
    const chunk = subscribers.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((s) => processOne(env, s.email, s.shopDomain.toLowerCase())),
    );
    for (const r of results) {
      if (r.status === "alerted") summary.alerted++;
      else if (r.status === "quiet") summary.quiet++;
      else if (r.status === "first-scan") summary.firstScan++;
      else summary.errors++;
    }
  }

  console.log(`[cron] done`, summary);
  return summary;
}
