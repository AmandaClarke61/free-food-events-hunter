"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { EventCard } from "@/components/EventCard";
import type { EventDTO } from "@/lib/event";

export default function BookmarksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    fetch("/api/bookmarks")
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="py-12 text-center text-cute-muted font-semibold">Loading...</div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-cute-text">
        &#10084;&#65039; My Bookmarks
      </h1>
      <p className="mt-1 text-sm text-cute-light font-semibold">
        {events.length} saved event{events.length !== 1 ? "s" : ""}
      </p>

      {events.length === 0 ? (
        <div className="mt-12 text-center text-cute-light">
          <div className="text-4xl mb-3">&#128154;</div>
          <p className="font-bold">No bookmarked events yet.</p>
          <p className="mt-1 text-sm">
            Click the heart icon on any event to save it here!
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
