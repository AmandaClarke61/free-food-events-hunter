"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { ViewSwitcher } from "./ViewSwitcher";

const DEFAULT_TOPICS = [
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

  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [topics, setTopics] = useState(DEFAULT_TOPICS);

  useEffect(() => {
    fetch("/api/topics")
      .then((r) => r.json())
      .then((data) => {
        if (data.topics?.length > 0) setTopics(data.topics);
      })
      .catch(() => {}); // keep defaults on error
  }, []);

  // Sync from URL -> local state when searchParams change externally
  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  // Debounce: auto-search 300ms after typing stops
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const current = searchParams.get("search") ?? "";
      if (searchInput !== current) {
        updateParams({ search: searchInput || null });
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

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
            placeholder="Search events..."
            value={searchInput}
            maxLength={100}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (debounceRef.current) clearTimeout(debounceRef.current);
                updateParams({ search: searchInput || null });
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
        {topics.map((topic) => (
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
