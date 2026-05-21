export interface Env {
  ENVIRONMENT?: string;
  SCANNER_VERSION?: string;
  SCANS?: KVNamespace;
  REPORTS?: R2Bucket;
  DB?: D1Database;
  /** Bearer token for marketing.weaverse.io's contacts API. */
  AGENT_SECRET?: string;
  /** Optional override for staging the marketing-tools target. */
  MARKETING_BASE_URL?: string;
  /** Shared secret for the X-Zephyr-Internal bypass header — lets the
   *  daily cron and other internal callers skip rate limiting. */
  INTERNAL_SECRET?: string;
}

export const API_VERSION = "0.1.0";
export const CHECKS_TOTAL = 15;
export const LIMITED_COVERAGE_THRESHOLD = 10;
export const SCAN_CACHE_TTL_SECONDS = 60 * 60; // 1h
export const USER_AGENT = `ZephyrScanner/${API_VERSION} (+https://zephyr.build)`;
