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

  if (!authLoading && !user) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-3">&#11088;</div>
        <h2 className="text-xl font-bold text-cute-text">
          Get personalized recommendations
        </h2>
        <p className="mt-2 text-sm text-cute-light font-semibold">
          Log in to see events tailored to your interests.
        </p>
        <Link href="/login" className="btn-primary mt-4 inline-block">
          Log in
        </Link>
      </div>
    );
  }

  if (authLoading || loading) {
    return <SkeletonCard count={3} />;
  }

  if (interests.length === 0 || editing) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-bold text-cute-text">
          {editing ? "Edit your interests" : "Pick topics you like! 🎨"}
        </h2>
        <p className="mt-1 text-sm text-cute-light font-semibold">
          Select up to 10 topics to personalize your recommendations.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {availableTopics.map((topic) => (
            <button
              key={topic}
              onClick={() => toggleTopic(topic)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition-all duration-300 ${
                selectedTopics.includes(topic)
                  ? "bg-gradient-to-r from-pink to-purple text-white shadow-sm"
                  : "bg-cream-dark text-cute-light hover:bg-purple-light hover:text-purple"
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
            className="btn-primary disabled:opacity-50"
          >
            {saving ? "Saving..." : "Done ✨"}
          </button>
          {editing && (
            <button
              onClick={() => {
                setSelectedTopics(interests);
                setEditing(false);
              }}
              className="text-sm text-cute-muted hover:text-cute-text font-bold transition-colors"
            >
              Cancel
            </button>
          )}
          {selectedTopics.length > 0 && (
            <span className="text-xs text-cute-muted font-bold">
              {selectedTopics.length}/10 selected
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {interests.map((topic) => (
          <span
            key={topic}
            className="badge bg-purple-light text-purple"
          >
            {topic}
          </span>
        ))}
        <button
          onClick={() => {
            setSelectedTopics(interests);
            setEditing(true);
          }}
          className="text-xs text-pink hover:text-pink-dark font-bold"
        >
          Edit
        </button>
      </div>

      {events.length === 0 ? (
        <div className="py-12 text-center text-cute-light">
          <div className="text-4xl mb-3">&#128533;</div>
          <p className="text-lg font-bold">No recommended events right now</p>
          <p className="mt-1 text-sm">Check back soon!</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-cute-light font-semibold">
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
                className="btn-secondary disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : `Load more (${events.length}/${total})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
