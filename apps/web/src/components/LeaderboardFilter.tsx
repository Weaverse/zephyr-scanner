import { useState } from "react";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "commerce", label: "Commerce" },
  { value: "product-data", label: "Product Data" },
  { value: "checkout", label: "Checkout" },
  { value: "discoverability", label: "Discoverability" },
  { value: "content", label: "Content" },
];

const PERIODS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

export default function LeaderboardFilter({
  initialCategory,
  initialPeriod,
}: {
  initialCategory: string;
  initialPeriod: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [period, setPeriod] = useState(initialPeriod);

  function apply() {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (period) params.set("period", period);
    window.location.search = params.toString();
  }

  return (
    <div className="flex flex-wrap items-end gap-3 mb-6">
      <label className="text-sm">
        <span className="block mb-1 text-zephyr-700 font-medium">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-md border border-zephyr-200 bg-white"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="block mb-1 text-zephyr-700 font-medium">Period</span>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 rounded-md border border-zephyr-200 bg-white"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={apply}
        className="px-4 py-2 rounded-md bg-zephyr-600 text-white text-sm font-medium hover:bg-zephyr-700"
      >
        Apply
      </button>
    </div>
  );
}
