import { useState } from "react";
import { API_BASE } from "../lib/api";

interface Props {
  domain: string;
}

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; email: string }
  | { kind: "error"; message: string };

export default function SubscribeForm({ domain }: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setState({ kind: "error", message: "Please enter your email." });
      return;
    }
    setState({ kind: "submitting" });
    try {
      const res = await fetch(`${API_BASE}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), domain }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setState({
          kind: "error",
          message: data.error ?? `Subscription failed (HTTP ${res.status})`,
        });
        return;
      }
      setState({ kind: "success", email: email.trim() });
    } catch (err) {
      setState({
        kind: "error",
        message: `Network error: ${(err as Error).message}`,
      });
    }
  }

  if (state.kind === "success") {
    return (
      <div
        className="rounded-md border border-grade-a/30 bg-grade-a/10 text-grade-a px-4 py-3 text-sm"
        role="status"
      >
        <strong>You're in.</strong> We'll email <span className="font-mono">{state.email}</span>{" "}
        whenever {domain}'s agent-readiness score moves more than 5 points or a critical check flips.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <p className="text-sm text-zephyr-700">
        Watch <span className="font-mono">{domain}</span> — we'll re-scan daily and email you when
        the score changes or a critical check flips.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="you@yourstore.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 px-3 py-2 rounded-md border border-zephyr-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zephyr-500"
          aria-label="Email address"
          disabled={state.kind === "submitting"}
        />
        <button
          type="submit"
          disabled={state.kind === "submitting"}
          className="px-4 py-2 rounded-md bg-zephyr-600 text-white text-sm font-medium hover:bg-zephyr-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {state.kind === "submitting" ? "Subscribing…" : "Watch this store →"}
        </button>
      </div>
      {state.kind === "error" && (
        <p className="text-sm text-grade-f" role="alert">
          {state.message}
        </p>
      )}
      <p className="text-xs text-zephyr-700/70">
        Free. One email per change. Unsubscribe anytime.
      </p>
    </form>
  );
}
