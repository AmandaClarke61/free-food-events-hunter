import { Suspense } from "react";
import { FreeFoodEventFeedClient } from "./client";
import { SkeletonCard } from "@/components/SkeletonCard";
import { AuthGate } from "@/components/AuthGate";

export default function FreeFoodPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-mint">
          &#127829; Free Food Events
        </h1>
        <p className="mt-1 text-sm text-cute-light font-semibold">
          Upcoming MIT events with free food, automatically detected
        </p>
      </div>

      <AuthGate>
        <Suspense fallback={<SkeletonCard count={6} />}>
          <FreeFoodEventFeedClient />
        </Suspense>
      </AuthGate>
    </div>
  );
}
