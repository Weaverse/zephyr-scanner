// Web Crypto SHA-256 hex.
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeUrl(raw: string): URL {
  return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
}

export async function cacheKeyForUrl(url: string): Promise<string> {
  const normalized = normalizeUrl(url).toString();
  return `cache:${await sha256Hex(normalized)}`;
}

export function nanoid12(): string {
  // Workers ship crypto.getRandomValues; 9 bytes → 12 base64url chars
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
