"use client";

import type { EventDTO } from "@/lib/event";
import { BookmarkButton } from "./BookmarkButton";
import { AddToScheduleButton } from "./AddToScheduleButton";

function relativeDate(start: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86400000);

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
      className={`card block p-4 ${isPast ? "opacity-50" : ""}`}
    >
      <div className="flex gap-3">
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt=""
            loading="lazy"
            className="h-20 w-20 rounded-2xl object-cover flex-shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-cute-text leading-tight line-clamp-2">
              {event.title}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {event.score != null && event.score > 0 && (
                <span className="badge bg-purple-light text-purple">
                  &#11088; Recommended
                </span>
              )}
              {event.hasFreeFood && (
                <span className="badge bg-mint-light text-mint">
                  &#127829; Free Food
                </span>
              )}
              <AddToScheduleButton
                eventId={event.id}
                eventTitle={event.title}
                startTime={event.startTime}
                endTime={event.endTime}
                location={event.location}
              />
              <BookmarkButton
                eventId={event.id}
                initialBookmarked={event.isBookmarked}
              />
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-cute-light">
            <span>{dateLabel}{endTimeStr ? ` – ${endTimeStr}` : ""}</span>
            {isPast && (
              <span className="badge bg-cream-dark text-cute-muted text-xs">
                Ended
              </span>
            )}
            {event.location && (
              <span className="truncate max-w-[200px]">{event.location}</span>
            )}
          </div>

          {event.foodDetails && (
            <p className="mt-1.5 text-sm text-mint font-semibold">{event.foodDetails}</p>
          )}

          {event.description && (
            <p className="mt-1.5 text-sm text-cute-light line-clamp-2">
              {event.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.topics.map((topic) => (
              <span
                key={topic}
                className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs font-semibold text-cute-light"
              >
                {topic}
              </span>
            ))}
            {event.sources.map((src) => (
              <span
                key={src}
                className="rounded-full bg-purple-light px-2.5 py-0.5 text-xs font-semibold text-purple"
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
