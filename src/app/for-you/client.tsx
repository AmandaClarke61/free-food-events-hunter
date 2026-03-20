"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { EventCard } from "@/components/EventCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import type { EventDTO } from "@/lib/event";

const PAGE_SIZE = 20;

export function ForYouClient() {
  const { user, loading: authLoading } = useAuth();
  const [interests, setInterests] = useState<string[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Fetch user interests + available topics on mount
  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }

    Promise.all([
      fetch("/api/user/interests").then((r) => r.json()),
      fetch("/api/topics").then((r) => r.json()),
    ])
      .then(([interestsData, topicsData]) => {
        const userInterests: string[] = interestsData.interests ?? [];
        setInterests(userInterests);
        setSelectedTopics(userInterests);
        setAvailableTopics(topicsData.topics ?? []);

        if (userInterests.length > 0) {
          return loadEvents(0);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const loadEvents = (offset: number) => {
    return fetch(
      `/api/events?forYou=true&limit=${PAGE_SIZE}&offset=${offset}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (offset === 0) {
          setEvents(data.events ?? []);
        } else {
          setEvents((prev) => [...prev, ...(data.events ?? [])]);
        }
        setTotal(data.total ?? 0);
      });
  };

  const loadMore = () => {
    setLoadingMore(true);
    loadEvents(events.length).finally(() => setLoadingMore(false));
  };

  const saveInterests = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/interests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selectedTopics }),
      });
      const data = await res.json();
      if (res.ok) {
        setInterests(data.interests);
        setEditing(false);
        setLoading(true);
        await loadEvents(0);
        setLoading(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : prev.length < 10
          ? [...prev, topic]
          : prev
    );
  };

  // --- State 1: Not logged in ---
  if (!authLoading && !user) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Get personalized recommendations
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Log in to see events tailored to your interests.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (authLoading || loading) {
    return <SkeletonCard count={3} />;
  }

  // --- State 2: No interests set / Editing ---
  if (interests.length === 0 || editing) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {editing ? "Edit your interests" : "Pick topics you're interested in"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Select up to 10 topics to personalize your recommendations.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {availableTopics.map((topic) => (
            <button
              key={topic}
              onClick={() => toggleTopic(topic)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                selectedTopics.includes(topic)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={saveInterests}
            disabled={selectedTopics.length === 0 || saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Done"}
          </button>
          {editing && (
            <button
              onClick={() => {
                setSelectedTopics(interests);
                setEditing(false);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          )}
          {selectedTopics.length > 0 && (
            <span className="text-xs text-gray-400">
              {selectedTopics.length}/10 selected
            </span>
          )}
        </div>
      </div>
    );
  }

  // --- State 3: Has interests, show recommendations ---
  return (
    <div>
      {/* Interest tags bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {interests.map((topic) => (
          <span
            key={topic}
            className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
          >
            {topic}
          </span>
        ))}
        <button
          onClick={() => {
            setSelectedTopics(interests);
            setEditing(true);
          }}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          Edit
        </button>
      </div>

      {events.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <p className="text-lg font-medium">
            No recommended events right now
          </p>
          <p className="mt-1 text-sm">Check back soon!</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500">
            {total} recommended event{total !== 1 ? "s" : ""}
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
                {loadingMore
                  ? "Loading..."
                  : `Load more (showing ${events.length} of ${total})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
