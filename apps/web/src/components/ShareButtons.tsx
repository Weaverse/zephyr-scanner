import { useState } from "react";

interface Props {
  domain: string;
  score: number;
  grade: string;
}

type CopyState = { key: "link" | "embed"; status: "copied" | "failed" };

// Fallback for when the async Clipboard API is unavailable or blocked
// (e.g. inside an iframe without the clipboard-write permission, an
// unfocused document, or a non-secure context). Uses a temporary
// textarea + execCommand, which still works under a user gesture.
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function ShareButtons({ domain, score, grade }: Props) {
  const [copied, setCopied] = useState<CopyState | null>(null);

  const url = `https://isyourstoreagentready.com/scan/${domain}`;
  const tweet = `My Shopify store scored ${score}/100 on Agent Ready — the agent-readiness scanner for commerce.\n\nCheck yours: ${url}`;
  const embed = `<a href="${url}">\n  <img src="https://isyourstoreagentready.com/badge/${domain}.svg" alt="Agent readiness: ${grade} ${score}" />\n</a>`;

  async function copy(text: string, key: "link" | "embed") {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = legacyCopy(text);
    setCopied({ key, status: ok ? "copied" : "failed" });
    setTimeout(() => setCopied(null), 2400);
  }

  function label(key: "link" | "embed", base: string): string {
    if (copied?.key !== key) return base;
    return copied.status === "copied" ? "Copied!" : "Press ⌘/Ctrl+C";
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`}
          target="_blank"
          rel="noreferrer noopener"
          className="px-4 py-2 rounded-md bg-zephyr-900 text-white text-sm font-medium hover:bg-zephyr-700"
        >
          Share on Twitter
        </a>
        <button
          type="button"
          onClick={() => copy(url, "link")}
          className="px-4 py-2 rounded-md border border-zephyr-200 bg-white text-sm font-medium hover:bg-zephyr-100"
        >
          {label("link", "Copy link")}
        </button>
        <button
          type="button"
          onClick={() => copy(embed, "embed")}
          className="px-4 py-2 rounded-md border border-zephyr-200 bg-white text-sm font-medium hover:bg-zephyr-100"
        >
          {label("embed", "Copy badge embed")}
        </button>
      </div>
      <details
        className="text-sm text-zephyr-700"
        open={copied?.key === "embed" && copied.status === "failed"}
      >
        <summary className="cursor-pointer select-none">Show badge embed code</summary>
        <pre className="mt-2 p-3 rounded bg-zephyr-900 text-zephyr-100 text-xs overflow-x-auto font-mono">
{embed}
        </pre>
      </details>
    </div>
  );
}
