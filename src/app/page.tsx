import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { EventsView } from "@/components/EventsView";
import { SkeletonCard } from "@/components/SkeletonCard";
import { AuthGate } from "@/components/AuthGate";
import { SchoolTabs } from "@/components/SchoolTabs";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cute-text">
          &#128218; Campus Events
        </h1>
        <p className="mt-1 text-sm text-cute-light font-semibold">
          Aggregated from MIT and Harvard event calendars
        </p>
      </div>

      <AuthGate>
        <Suspense fallback={<SkeletonCard count={6} />}>
          <SchoolTabs />
          <FilterBar />
          <EventsView />
        </Suspense>
      </AuthGate>
    </div>
  );
}
