"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { EventCard } from "./EventCard";
import type { EventDTO } from "@/lib/event";

const PAGE_SIZE = 20;

function SkeletonCard() {
  return (
    <div className="animate-pulse card p-4">
      <div className="flex gap-3">
        <div className="h-20 w-20 rounded-2xl bg-cream-dark flex-shrink-0" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-4 w-3/4 rounded-full bg-cream-dark" />
          <div className="h-3 w-1/2 rounded-full bg-cream-dark" />
          <div className="h-3 w-full rounded-full bg-cream-dark" />
        </div>
      </div>
    </div>
  );
}

export function EventFeed() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const initialRef = useRef(true);
  const prevParamsRef = useRef<string>("");

  const buildApiParams = () => {
    const params = new URLSearchParams();
    const freeFood = searchParams.get("freeFood");
    const topic = searchParams.get("topic");
    const search = searchParams.get("search");
    const date = searchParams.get("date");

    if (freeFood) params.set("freeFood", freeFood);
    if (topic) params.set("topic", topic);
    if (search) params.set("search", search);
    if (date) {
      params.set("dateFrom", date);
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      params.set("dateTo", next.toISOString().split("T")[0]);
    }
    params.set("limit", String(PAGE_SIZE));
    return params;
  };

  useEffect(() => {
    const paramsKey = searchParams.toString();
    if (!initialRef.current && paramsKey === prevParamsRef.current) return;
    initialRef.current = false;
    prevParamsRef.current = paramsKey;

    const params = buildApiParams();
    params.set("offset", "0");

    setLoading(true);
    fetch(`/api/events?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setTotal(data.total ?? 0);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    topRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadMore = () => {
    const params = buildApiParams();
    params.set("offset", String(events.length));

    setLoadingMore(true);
    fetch(`/api/events?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents((prev) => [...prev, ...(data.events ?? [])]);
        setTotal(data.total ?? 0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMore(false));
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-pink-light p-4 text-sm text-pink-dark font-semibold border-2 border-pink/20">
        Failed to load events: {error}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-12 text-center text-cute-light">
        <div className="text-4xl mb-3">&#128533;</div>
        <p className="text-lg font-bold">No events found</p>
        <p className="mt-1 text-sm">Try adjusting your filters or check back later.</p>
      </div>
    );
  }

  return (
    <div>
      <div ref={topRef} />
      <p className="mb-4 text-sm text-cute-light font-semibold">
        {total} event{total !== 1 ? "s" : ""} found
      </p>
      <div className="space-y-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
      {events.length < total && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-secondary disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : `Load more (${events.length}/${total})`}
          </button>
        </div>
      )}
    </div>
  );
}
