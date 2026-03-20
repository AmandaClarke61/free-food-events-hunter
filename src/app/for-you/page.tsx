import { Suspense } from "react";
import { ForYouClient } from "./client";
import { SkeletonCard } from "@/components/SkeletonCard";

export default function ForYouPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-800">For You</h1>
        <p className="mt-1 text-sm text-gray-500">
          Events recommended based on your interests
        </p>
      </div>

      <Suspense fallback={<SkeletonCard count={6} />}>
        <ForYouClient />
      </Suspense>
    </div>
  );
}
