"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type Tab = { value: "" | "mit" | "harvard"; label: string; emoji: string };

const TABS: Tab[] = [
  { value: "", label: "All", emoji: "🌐" },
  { value: "mit", label: "MIT", emoji: "🦫" },
  { value: "harvard", label: "Harvard", emoji: "🎓" },
];

export function SchoolTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = (searchParams.get("school") ?? "") as Tab["value"];

  const setSchool = useCallback(
    (value: Tab["value"]) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set("school", value);
      else next.delete("school");
      const q = next.toString();
      router.replace(q ? `?${q}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div
      role="tablist"
      aria-label="Filter events by school"
      className="inline-flex rounded-full bg-cream-dark/40 p-1 gap-1"
    >
      {TABS.map((tab) => {
        const active = current === tab.value;
        return (
          <button
            key={tab.value || "all"}
            role="tab"
            aria-selected={active}
            onClick={() => setSchool(tab.value)}
            className={
              "px-4 py-1.5 rounded-full text-sm font-semibold transition " +
              (active
                ? "bg-white text-cute-text shadow-sm"
                : "text-cute-light hover:text-cute-text")
            }
          >
            <span className="mr-1.5">{tab.emoji}</span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
