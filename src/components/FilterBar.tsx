"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ViewSwitcher } from "./ViewSwitcher";

const TOPICS = [
  "academics", "career", "social", "research", "workshop",
  "technology", "arts", "sports", "health", "networking",
  "entrepreneurship", "community", "diversity",
];

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const freeFood = searchParams.get("freeFood") === "true";
  const activeTopic = searchParams.get("topic") ?? "";
  const search = searchParams.get("search") ?? "";
  const date = searchParams.get("date") ?? "";

  const hasActiveFilters = freeFood || activeTopic || search || date;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams();
    const view = searchParams.get("view");
    if (view) params.set("view", view);
    router.push(`?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search events... (press Enter)"
            defaultValue={search}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateParams({ search: e.currentTarget.value || null });
              }
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <input
          type="date"
          value={date}
          onChange={(e) => updateParams({ date: e.target.value || null })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <button
          onClick={() => updateParams({ freeFood: freeFood ? null : "true" })}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            freeFood
              ? "bg-green-600 text-white shadow-sm"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          Free Food Only
        </button>

        <ViewSwitcher />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TOPICS.map((topic) => (
          <button
            key={topic}
            onClick={() =>
              updateParams({ topic: activeTopic === topic ? null : topic })
            }
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              activeTopic === topic
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {topic}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
