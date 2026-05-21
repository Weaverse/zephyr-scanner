import { useEffect, useState } from "react";

const STORAGE_KEY = "zephyr:last-scan";

export default function ScanInput() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from localStorage on mount. We don't set this as the initial
  // useState value because that would run server-side (Astro SSR) where
  // localStorage doesn't exist — and React's hydration would then mismatch.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setValue(saved);
    } catch {
      // localStorage may be disabled (private mode, embed in iframe with
      // partitioned storage, etc) — silently fall back to empty input.
    }
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a URL.");
      return;
    }
    let domain: string;
    try {
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      domain = url.hostname;
    } catch {
      setError("That doesn't look like a valid URL.");
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, domain);
    } catch {
      // ignore — same caveats as above
    }
    setLoading(true);
    window.location.href = `/scan/${encodeURIComponent(domain)}`;
  }

  return (
    <form onSubmit={submit} className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="https://yourstore.com"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 px-4 py-3 rounded-lg border border-zephyr-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-zephyr-500 placeholder:text-zephyr-700/40"
          aria-label="Store URL to scan"
          autoComplete="url"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 rounded-lg bg-zephyr-600 text-white font-medium hover:bg-zephyr-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {loading ? "Scanning…" : "Scan now →"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-grade-f" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
