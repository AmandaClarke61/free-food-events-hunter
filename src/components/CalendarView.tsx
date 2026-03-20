"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { EventCard } from "./EventCard";
import type { EventDTO } from "@/lib/event";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatMonth(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Determine initial month from date param or today
  const dateParam = searchParams.get("date");
  const initialMonth = dateParam ? startOfMonth(new Date(dateParam)) : startOfMonth(new Date());

  const [month, setMonth] = useState(initialMonth);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(dateParam);

  // Navigate month when date param changes externally
  useEffect(() => {
    const dp = searchParams.get("date");
    if (dp) {
      setMonth(startOfMonth(new Date(dp)));
      setSelectedDate(dp);
    }
  }, [searchParams]);

  // Fetch events for the visible month
  useEffect(() => {
    const params = new URLSearchParams();
    const freeFood = searchParams.get("freeFood");
    const topic = searchParams.get("topic");
    const search = searchParams.get("search");

    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 1);

    params.set("dateFrom", from.toISOString().split("T")[0]);
    params.set("dateTo", to.toISOString().split("T")[0]);
    params.set("limit", "200");

    if (freeFood) params.set("freeFood", freeFood);
    if (topic) params.set("topic", topic);
    if (search) params.set("search", search);

    setLoading(true);
    fetch(`/api/events?${params}`)
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .finally(() => setLoading(false));
  }, [month, searchParams]);

  // Group events by date key
  const eventsByDate = useMemo(() => {
    const map: Record<string, EventDTO[]> = {};
    for (const ev of events) {
      const key = toDateKey(new Date(ev.startTime));
      (map[key] ??= []).push(ev);
    }
    return map;
  }, [events]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const days: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    return days;
  }, [month]);

  const todayKey = toDateKey(new Date());

  const navigateMonth = useCallback((delta: number) => {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    setSelectedDate(null);
  }, []);

  const handleDateClick = useCallback(
    (day: number) => {
      const key = toDateKey(new Date(month.getFullYear(), month.getMonth(), day));
      setSelectedDate((prev) => (prev === key ? null : key));
    },
    [month]
  );

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigateMonth(-1)}
          className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50"
          aria-label="Previous month"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 4 L6 8 L10 12" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-900">{formatMonth(month)}</h2>
        <button
          onClick={() => navigateMonth(1)}
          className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50"
          aria-label="Next month"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 4 L10 8 L6 12" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg border border-gray-200 bg-gray-200 overflow-hidden">
        {calendarDays.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="bg-gray-50 min-h-[80px] sm:min-h-[100px]" />;
          }

          const key = toDateKey(new Date(month.getFullYear(), month.getMonth(), day));
          const dayEvents = eventsByDate[key] ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const hasFreeFoodEvent = dayEvents.some((e) => e.hasFreeFood);

          return (
            <button
              key={key}
              onClick={() => handleDateClick(day)}
              className={`bg-white min-h-[80px] sm:min-h-[100px] p-1.5 text-left transition hover:bg-gray-50 ${
                isToday ? "bg-blue-50" : ""
              } ${isSelected ? "ring-2 ring-inset ring-blue-500" : ""}`}
            >
              <div className="flex items-center gap-1">
                <span
                  className={`text-sm font-medium ${
                    isToday ? "text-blue-700" : "text-gray-900"
                  }`}
                >
                  {day}
                </span>
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5">
                    {hasFreeFoodEvent && (
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    )}
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  </div>
                )}
              </div>
              {/* Desktop: show truncated event titles */}
              <div className="hidden sm:block mt-1 space-y-0.5">
                {dayEvents.slice(0, 2).map((ev) => (
                  <p key={ev.id} className="text-xs text-gray-600 truncate">
                    {ev.title}
                  </p>
                ))}
                {dayEvents.length > 2 && (
                  <p className="text-xs text-gray-400">+{dayEvents.length - 2} more</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="mt-4 flex items-center justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
        </div>
      )}

      {/* Selected day events */}
      {selectedDate && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-medium text-gray-700">
            Events on{" "}
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No events on this day.</p>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
