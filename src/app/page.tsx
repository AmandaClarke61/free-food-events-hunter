import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { EventsView } from "@/components/EventsView";
import { SkeletonCard } from "@/components/SkeletonCard";
import { AuthGate } from "@/components/AuthGate";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">MIT Campus Events</h1>
        <p className="mt-1 text-sm text-gray-500">
          Aggregated from calendar.mit.edu, Engage, and GSC announcements
        </p>
      </div>

      <AuthGate>
        <Suspense fallback={<SkeletonCard count={6} />}>
          <FilterBar />
          <EventsView />
        </Suspense>
      </AuthGate>
    </div>
  );
}
