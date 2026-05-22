import { useState } from "react";

interface Props {
  domain: string;
  score: number;
  grade: string;
}

export default function ShareButtons({ domain, score, grade }: Props) {
  const [copied, setCopied] = useState<null | "link" | "embed">(null);

  const url = `https://isyourstoreagentready.com/scan/${domain}`;
  const tweet = `My Shopify store scored ${score}/100 on Agent Ready — the agent-readiness scanner for commerce.\n\nCheck yours: ${url}`;
  const embed = `<a href="${url}">\n  <img src="https://isyourstoreagentready.com/badge/${domain}.svg" alt="Agent readiness: ${grade} ${score}" />\n</a>`;

  async function copy(text: string, key: "link" | "embed") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // ignore — surface inline instead?
    }
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
          {copied === "link" ? "Copied!" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={() => copy(embed, "embed")}
          className="px-4 py-2 rounded-md border border-zephyr-200 bg-white text-sm font-medium hover:bg-zephyr-100"
        >
          {copied === "embed" ? "Copied!" : "Copy badge embed"}
        </button>
      </div>
      <details className="text-sm text-zephyr-700">
        <summary className="cursor-pointer select-none">Show badge embed code</summary>
        <pre className="mt-2 p-3 rounded bg-zephyr-900 text-zephyr-100 text-xs overflow-x-auto font-mono">
{embed}
        </pre>
      </details>
    </div>
  );
}
