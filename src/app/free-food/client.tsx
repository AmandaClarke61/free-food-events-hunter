"use client";

import { useEffect, useState } from "react";
import { EventCard } from "@/components/EventCard";
import type { EventDTO } from "@/lib/event";
import { SkeletonCard } from "@/components/SkeletonCard";

const PAGE_SIZE = 20;

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
    return <SkeletonCard count={3} />;
  }

  if (events.length === 0) {
    return (
      <div className="py-12 text-center text-cute-light">
        <div className="text-4xl mb-3">&#127829;</div>
        <p className="text-lg font-bold">No free food events right now</p>
        <p className="mt-1 text-sm">Check back soon — events update every 6 hours!</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-cute-light font-semibold">
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
            className="btn-secondary disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : `Load more (${events.length}/${total})`}
          </button>
        </div>
      )}
    </div>
  );
}
