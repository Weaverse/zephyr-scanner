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
      <div className="group relative">
        {/* Animated gradient glow halo to draw the eye. */}
        <div
          aria-hidden="true"
          className="scan-glow absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-brand-500 via-sky-400 to-brand-500 opacity-40 blur-xl"
        />
        <div className="relative flex flex-col gap-2 rounded-xl bg-white p-1.5 shadow-xl shadow-brand-600/10 ring-1 ring-zephyr-200 transition group-focus-within:ring-2 group-focus-within:ring-brand-500 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-500">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="https://yourstore.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg bg-transparent py-2.5 pl-11 pr-4 text-base text-zephyr-900 focus:outline-none placeholder:text-zephyr-700/40"
              aria-label="Store URL to scan"
              autoComplete="url"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="group/btn inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-base font-semibold text-white shadow-lg shadow-brand-600/30 transition-all hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              "Scanning…"
            ) : (
              <>
                Scan now
                <span className="transition-transform duration-200 group-hover/btn:translate-x-1">
                  →
                </span>
              </>
            )}
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-3 text-sm font-medium text-grade-f" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
