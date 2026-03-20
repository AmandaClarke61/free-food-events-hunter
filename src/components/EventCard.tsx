"use client";

import type { EventDTO } from "@/lib/event";
import { BookmarkButton } from "./BookmarkButton";

function relativeDate(start: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86400000);

  // If time is exactly midnight, the source likely didn't provide a time — omit it
  const hasTime = start.getHours() !== 0 || start.getMinutes() !== 0;
  const timeStr = hasTime
    ? start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  const datePart = (() => {
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    return start.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  })();

  return timeStr ? `${datePart} at ${timeStr}` : datePart;
}

export function EventCard({ event }: { event: EventDTO }) {
  const start = new Date(event.startTime);
  const end = event.endTime ? new Date(event.endTime) : null;

  const dateLabel = relativeDate(start);
  const isPast = start.getTime() < Date.now();

  const hasTime = start.getHours() !== 0 || start.getMinutes() !== 0;
  const endTimeStr = end && hasTime
    ? end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <a
      href={event.url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-gray-300 ${
        isPast ? "opacity-60" : ""
      }`}
    >
      <div className="flex gap-3">
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt=""
            loading="lazy"
            className="h-20 w-20 rounded-md object-cover flex-shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 leading-tight line-clamp-2">
              {event.title}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {event.score != null && event.score > 0 && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  Recommended
                </span>
              )}
              {event.hasFreeFood && (
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  Free Food
                </span>
              )}
              <BookmarkButton
                eventId={event.id}
                initialBookmarked={event.isBookmarked}
              />
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            <span>{dateLabel}{endTimeStr ? ` – ${endTimeStr}` : ""}</span>
            {isPast && (
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-500">
                Ended
              </span>
            )}
            {event.location && (
              <span className="truncate max-w-[200px]">{event.location}</span>
            )}
          </div>

          {event.foodDetails && (
            <p className="mt-1.5 text-sm text-green-700">{event.foodDetails}</p>
          )}

          {event.description && (
            <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">
              {event.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.topics.map((topic) => (
              <span
                key={topic}
                className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {topic}
              </span>
            ))}
            {event.sources.map((src) => (
              <span
                key={src}
                className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
              >
                {src}
              </span>
            ))}
          </div>
        </div>
      </div>
    </a>
  );
}
