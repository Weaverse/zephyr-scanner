// Thin client over marketing.weaverse.io's CRM API. Talks to the existing
// Weaverse marketing-tools repo (`marketing.weaverse.io`) so zephyr-scanner
// doesn't reimplement contacts / Resend / lifecycle email — the marketing
// app already owns those.

const MARKETING_BASE =
  // Override in env for staging; production points at the canonical Worker.
  "https://marketing.weaverse.io";

const MAILING_LIST = "zephyr-alerts";

export interface MarketingEnv {
  /** Bearer token shared with marketing-tools. Set via
   *  `wrangler secret put AGENT_SECRET` on the API Worker. */
  AGENT_SECRET?: string;
  /** Optional override of the marketing-tools base URL (staging / dev). */
  MARKETING_BASE_URL?: string;
}

interface UpsertPayload {
  email: string;
  shopDomain: string;
  event: string;
  source?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventProperties?: Record<string, any>;
}

interface EventPayload {
  email: string;
  eventName: string;
  properties?: Record<string, string>;
}

function baseUrl(env: MarketingEnv): string {
  return env.MARKETING_BASE_URL ?? MARKETING_BASE;
}

function authHeaders(env: MarketingEnv): Record<string, string> {
  if (!env.AGENT_SECRET) {
    throw new Error("AGENT_SECRET missing — set via wrangler secret put");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.AGENT_SECRET}`,
  };
}

/** Add or refresh a contact in marketing-tools' contacts table and tag them
 *  for zephyr-alerts. Used on the /subscribe flow. */
export async function upsertZephyrContact(
  env: MarketingEnv,
  payload: UpsertPayload,
): Promise<void> {
  const res = await fetch(`${baseUrl(env)}/api/contacts/upsert`, {
    method: "POST",
    headers: authHeaders(env),
    body: JSON.stringify({
      email: payload.email,
      shopDomain: payload.shopDomain,
      mailingLists: [MAILING_LIST],
      source: payload.source ?? "zephyr",
      event: payload.event,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `marketing-tools upsert failed: ${res.status} ${await res.text().catch(() => "")}`,
    );
  }
}

/** Log a contact event (e.g. zephyr_score_changed). marketing-tools dispatches
 *  the corresponding lifecycle email when the event handler matches. */
export async function postZephyrEvent(
  env: MarketingEnv,
  payload: EventPayload,
): Promise<void> {
  const res = await fetch(`${baseUrl(env)}/api/contacts/event`, {
    method: "POST",
    headers: authHeaders(env),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      `marketing-tools event failed: ${res.status} ${await res.text().catch(() => "")}`,
    );
  }
}

export interface ZephyrSubscriber {
  email: string;
  shopDomain: string;
}

/** Pull all confirmed subscribers in the zephyr-alerts mailing list. Used
 *  by the daily cron to know which domains to re-scan. */
export async function listZephyrSubscribers(
  env: MarketingEnv,
): Promise<ZephyrSubscriber[]> {
  const res = await fetch(
    `${baseUrl(env)}/api/contacts/list?mailingList=${encodeURIComponent(MAILING_LIST)}`,
    { headers: authHeaders(env) },
  );
  if (!res.ok) {
    throw new Error(
      `marketing-tools list failed: ${res.status} ${await res.text().catch(() => "")}`,
    );
  }
  const data = (await res.json()) as { contacts?: ZephyrSubscriber[] };
  return data.contacts ?? [];
}
