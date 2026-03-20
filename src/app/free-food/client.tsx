"use client";

import { useEffect, useState } from "react";
import { EventCard } from "@/components/EventCard";
import type { EventDTO } from "@/lib/event";

const PAGE_SIZE = 20;

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex gap-3">
        <div className="h-20 w-20 rounded-md bg-gray-200 flex-shrink-0" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="h-3 w-1/2 rounded bg-gray-200" />
          <div className="h-3 w-full rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

export function FreeFoodEventFeedClient() {
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetch(`/api/events?freeFood=true&limit=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const loadMore = () => {
    setLoadingMore(true);
    fetch(`/api/events?freeFood=true&limit=${PAGE_SIZE}&offset=${events.length}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents((prev) => [...prev, ...(data.events ?? [])]);
        setTotal(data.total ?? 0);
      })
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

  if (events.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        <p className="text-lg font-medium">No free food events right now</p>
        <p className="mt-1 text-sm">Check back soon — events are updated every 6 hours.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        {total} free food event{total !== 1 ? "s" : ""} coming up
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
            className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : `Load more (showing ${events.length} of ${total})`}
          </button>
        </div>
      )}
    </div>
  );
}
