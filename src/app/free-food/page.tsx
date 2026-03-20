import { Suspense } from "react";
import { FreeFoodEventFeedClient } from "./client";
import { SkeletonCard } from "@/components/SkeletonCard";

export default function FreeFoodPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-800">Free Food Events</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upcoming MIT events with free food, automatically detected
        </p>
      </div>

      <Suspense fallback={<SkeletonCard count={6} />}>
        <FreeFoodEventFeedClient />
      </Suspense>
    </div>
  );
}
