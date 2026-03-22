"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function ViewSwitcher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "list";

  const setView = useCallback(
    (v: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (v === "list") {
        params.delete("view");
      } else {
        params.set("view", v);
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex rounded-2xl border-2 border-cute-border overflow-hidden bg-cute-card">
      <button
        onClick={() => setView("list")}
        className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-bold transition-all duration-300 ${
          view !== "calendar"
            ? "bg-gradient-to-r from-pink to-purple text-white"
            : "text-cute-light hover:bg-cream-dark hover:text-cute-text"
        }`}
        aria-label="List view"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="2" y1="4" x2="14" y2="4" />
          <line x1="2" y1="8" x2="14" y2="8" />
          <line x1="2" y1="12" x2="14" y2="12" />
        </svg>
        List
      </button>
      <button
        onClick={() => setView("calendar")}
        className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-bold transition-all duration-300 border-l-2 border-cute-border ${
          view === "calendar"
            ? "bg-gradient-to-r from-pink to-purple text-white"
            : "text-cute-light hover:bg-cream-dark hover:text-cute-text"
        }`}
        aria-label="Calendar view"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" />
          <line x1="1.5" y1="6" x2="14.5" y2="6" />
          <line x1="5" y1="1" x2="5" y2="4" />
          <line x1="11" y1="1" x2="11" y2="4" />
        </svg>
        Calendar
      </button>
    </div>
  );
}
