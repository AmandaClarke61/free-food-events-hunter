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
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

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
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cute-muted text-base">&#128269;</span>
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
            className="input-field pl-10"
          />
        </div>

        <input
          type="date"
          value={date}
          onChange={(e) => updateParams({ date: e.target.value || null })}
          className="input-field w-auto"
        />

        <button
          onClick={() => updateParams({ freeFood: freeFood ? null : "true" })}
          className={`rounded-full px-5 py-3 text-sm font-bold transition-all duration-300 ${
            freeFood
              ? "bg-mint text-white shadow-md shadow-mint/30"
              : "bg-mint-light text-mint border-2 border-transparent hover:border-mint"
          }`}
        >
          &#127829; Free Food Only
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
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-300 ${
              activeTopic === topic
                ? "bg-gradient-to-r from-pink to-purple text-white shadow-sm"
                : "bg-cream-dark text-cute-light hover:bg-purple-light hover:text-purple"
            }`}
          >
            {topic}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="ml-2 text-xs text-pink font-bold hover:text-pink-dark"
          >
            &#10005; Clear
          </button>
        )}
      </div>
    </div>
  );
}
