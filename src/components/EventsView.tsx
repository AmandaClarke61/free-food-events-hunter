"use client";

import { useSearchParams } from "next/navigation";
import { EventFeed } from "./EventFeed";
import { CalendarView } from "./CalendarView";

export function EventsView() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "list";

  if (view === "calendar") {
    return <CalendarView />;
  }

  return <EventFeed />;
}
