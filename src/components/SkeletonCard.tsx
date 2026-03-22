export function SkeletonCard({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse card p-4">
          <div className="flex gap-3">
            <div className="h-20 w-20 rounded-2xl bg-cream-dark flex-shrink-0" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-4 w-3/4 rounded-full bg-cream-dark" />
              <div className="h-3 w-1/2 rounded-full bg-cream-dark" />
              <div className="h-3 w-full rounded-full bg-cream-dark" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
