# Personalized Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/for-you` page that ranks events based on user-selected interest tags and bookmark-derived implicit preferences.

**Architecture:** Extend User model with `interests` JSON field. Refactor `scoreEvent()` to combine explicit interests, implicit bookmark-derived topic frequencies, free food bonus, and time proximity. Add `forYou=true` param to existing events API that fetches all upcoming events, scores them in-memory, and returns sorted paginated results. New `/for-you` page with three states: not logged in, interest picker, recommendation feed.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 5 + SQLite, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-20-personalized-recommendations-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `prisma/schema.prisma` | Add `interests` field to User |
| Replace | `src/recommend/score.ts` | New scoring interfaces + `scoreEvent()` |
| Modify | `src/lib/event.ts` | Add optional `score` to `EventDTO` |
| Create | `src/app/api/user/interests/route.ts` | PUT endpoint for saving user interests |
| Modify | `src/app/api/events/route.ts` | Add `forYou=true` branch with scoring |
| Create | `src/components/NavLinks.tsx` | Auth-aware nav links (client component) |
| Modify | `src/app/layout.tsx` | Use `NavLinks` instead of inline links |
| Create | `src/app/for-you/page.tsx` | Server page wrapper |
| Create | `src/app/for-you/client.tsx` | Client component: 3-state For You page |

---

### Task 1: Add `interests` field to User model

**Files:**
- Modify: `prisma/schema.prisma:50-59`

- [ ] **Step 1: Add the field**

In `prisma/schema.prisma`, add `interests` to the User model after `name`:

```prisma
model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  name         String?
  interests    String?    // JSON array of topic strings
  verified     Boolean    @default(false)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  bookmarks    Bookmark[]
}
```

- [ ] **Step 2: Push schema**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add interests field to User model"
```

---

### Task 2: Refactor scoring logic

**Files:**
- Replace: `src/recommend/score.ts`

- [ ] **Step 1: Replace `score.ts` entirely**

Replace the full contents of `src/recommend/score.ts` with:

```typescript
export interface ScoringEvent {
  hasFreeFood: boolean;
  foodConfidence: number;
  topics: string[];
  startTime: Date;
}

export interface UserPreferences {
  explicitInterests: string[];
  implicitInterests: Record<string, number>;
}

export function scoreEvent(
  event: ScoringEvent,
  prefs: UserPreferences
): number {
  let score = 0;

  // Explicit interest match: +25 per matching topic
  for (const topic of event.topics) {
    if (prefs.explicitInterests.includes(topic)) {
      score += 25;
    }
  }

  // Implicit interest match: +5 * bookmark count per topic (cap 15)
  for (const topic of event.topics) {
    const count = prefs.implicitInterests[topic];
    if (count) {
      score += Math.min(count * 5, 15);
    }
  }

  // Free food bonus: +30 * confidence (unconditional)
  if (event.hasFreeFood) {
    score += 30 * event.foodConfidence;
  }

  // Time proximity: up to +20 within 48h
  const hoursAway =
    (event.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursAway > 0 && hoursAway < 48) {
    score += Math.max(0, 20 - hoursAway * 0.4);
  }

  return Math.round(score);
}
```

- [ ] **Step 2: Verify no other imports of old interfaces**

Run: `grep -rE "ScoringInput|prefersFreeFood" src/`
Expected: No matches (the old interfaces were only used inside `score.ts` and not imported elsewhere).

- [ ] **Step 3: Commit**

```bash
git add src/recommend/score.ts
git commit -m "feat: refactor scoreEvent with explicit/implicit interests"
```

---

### Task 3: Add `score` to EventDTO

**Files:**
- Modify: `src/lib/event.ts`

- [ ] **Step 1: Add optional score field**

In `src/lib/event.ts`, add `score` as the last field in the `EventDTO` interface:

```typescript
export interface EventDTO {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  hasFreeFood: boolean;
  foodDetails?: string | null;
  topics: string[];
  sources: string[];
  isBookmarked?: boolean;
  score?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/event.ts
git commit -m "feat: add optional score field to EventDTO"
```

---

### Task 4: Create PUT `/api/user/interests` endpoint

**Files:**
- Create: `src/app/api/user/interests/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/user/interests/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { interests } = body;

  // Validate: array of non-empty strings, max 10 items, max 50 chars each
  if (!Array.isArray(interests)) {
    return NextResponse.json(
      { error: "interests must be an array" },
      { status: 400 }
    );
  }
  if (interests.length > 10) {
    return NextResponse.json(
      { error: "Maximum 10 interests allowed" },
      { status: 400 }
    );
  }
  for (const item of interests) {
    if (typeof item !== "string" || item.trim().length === 0 || item.length > 50) {
      return NextResponse.json(
        { error: "Each interest must be a non-empty string (max 50 chars)" },
        { status: 400 }
      );
    }
  }

  const trimmed = interests.map((i: string) => i.trim());

  await prisma.user.update({
    where: { id: user.id },
    data: { interests: JSON.stringify(trimmed) },
  });

  return NextResponse.json({ interests: trimmed });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { interests: true },
  });

  const interests = dbUser?.interests
    ? (JSON.parse(dbUser.interests) as string[])
    : [];

  return NextResponse.json({ interests });
}
```

- [ ] **Step 2: Manual test**

Start dev server (`npm run dev`), then test with curl:

```bash
# Should return 401
curl -X PUT http://localhost:3000/api/user/interests \
  -H "Content-Type: application/json" \
  -d '{"interests": ["research"]}'

# Log in via browser, copy cookie, test with auth
# Should return {"interests": ["research","career"]}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/user/interests/route.ts
git commit -m "feat: add PUT/GET /api/user/interests endpoint"
```

---

### Task 5: Add `forYou` branch to events API

**Files:**
- Modify: `src/app/api/events/route.ts`

This is the most complex task. The `forYou=true` branch needs to:
1. Verify auth
2. Fetch user interests + bookmark topic frequencies
3. Fetch all upcoming events (no DB-level pagination)
4. Score, sort, and slice in-memory

- [ ] **Step 1: Add helper to build implicit interests from bookmarks**

At the top of `src/app/api/events/route.ts` (after imports), add:

```typescript
import { scoreEvent } from "@/recommend/score";
```

- [ ] **Step 2: Add forYou branch inside the GET handler**

After parsing URL params (after line 42: `const dateTo = ...`), add the `forYou` param:

```typescript
const forYou = params.get("forYou") === "true";
```

Then, before the existing `where` construction (before `const where: Record<string, unknown> = {};`), add the `forYou` branch. The full GET function should become:

```typescript
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const freeFood = params.get("freeFood") === "true" ? true : undefined;
  const topic = params.get("topic") ?? undefined;
  const search = params.get("search") ?? undefined;
  const limit = Math.min(parseInt(params.get("limit") ?? "50"), 100);
  const offset = parseInt(params.get("offset") ?? "0");
  const upcoming = params.get("upcoming") !== "false";
  const dateFrom = params.get("dateFrom") ?? undefined;
  const dateTo = params.get("dateTo") ?? undefined;
  const forYou = params.get("forYou") === "true";

  // --- forYou branch: score all upcoming events and return sorted ---
  if (forYou) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch user interests
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { interests: true },
    });
    const explicitInterests: string[] = dbUser?.interests
      ? JSON.parse(dbUser.interests)
      : [];

    // 2. Build implicit interests from bookmarked events
    const bookmarkedEvents = await prisma.bookmark.findMany({
      where: { userId: user.id },
      include: { event: { select: { topics: true } } },
    });
    const implicitInterests: Record<string, number> = {};
    for (const b of bookmarkedEvents) {
      const topics: string[] = JSON.parse(b.event.topics ?? "[]");
      for (const t of topics) {
        implicitInterests[t] = (implicitInterests[t] ?? 0) + 1;
      }
    }

    // 3. Fetch all upcoming events (with optional filters)
    const where: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) range.gte = dateToET(dateFrom);
      if (dateTo) range.lt = dateToET(dateTo);
      where.startTime = range;
    } else {
      where.startTime = { gte: new Date() };
    }
    if (freeFood) where.hasFreeFood = true;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { location: { contains: search } },
      ];
    }
    // topic filter is ignored for forYou (multi-topic by nature)

    const allEvents = await prisma.event.findMany({
      where,
      include: { sources: { select: { source: true } } },
    });

    // 4. Score and sort
    const prefs = { explicitInterests, implicitInterests };
    const scored = allEvents
      .map((e) => {
        const topics = JSON.parse(e.topics ?? "[]") as string[];
        return {
          event: e,
          topics,
          score: scoreEvent(
            {
              hasFreeFood: e.hasFreeFood,
              foodConfidence: e.foodConfidence,
              topics,
              startTime: e.startTime,
            },
            prefs
          ),
        };
      })
      .sort((a, b) =>
        b.score !== a.score
          ? b.score - a.score
          : a.event.startTime.getTime() - b.event.startTime.getTime()
      );

    // 5. In-memory pagination
    const total = scored.length;
    const page = scored.slice(offset, offset + limit);

    // 6. Attach bookmark status
    const eventIds = page.map((s) => s.event.id);
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: user.id, eventId: { in: eventIds } },
      select: { eventId: true },
    });
    const bookmarkedIds = new Set(bookmarks.map((b) => b.eventId));

    const formatted = page.map((s) => ({
      id: s.event.id,
      title: s.event.title,
      description: s.event.description,
      startTime: s.event.startTime,
      endTime: s.event.endTime,
      location: s.event.location,
      url: s.event.url,
      imageUrl: s.event.imageUrl,
      hasFreeFood: s.event.hasFreeFood,
      foodDetails: s.event.foodDetails,
      topics: s.topics,
      sources: s.event.sources.map((src) => src.source),
      isBookmarked: bookmarkedIds.has(s.event.id),
      score: s.score,
    }));

    return NextResponse.json({ events: formatted, total, limit, offset });
  }

  // --- existing non-forYou logic below (unchanged) ---
  const where: Record<string, unknown> = {};
  // ... rest of existing code stays exactly the same
```

Note: The existing code from `const where: Record<string, unknown> = {};` through the end of the function remains completely unchanged. Only the `forYou` param parsing and the `if (forYou) { ... }` block are added before it.

- [ ] **Step 3: Manual test**

```bash
# Not logged in — should 401
curl "http://localhost:3000/api/events?forYou=true"

# Logged in (via browser) — should return events with score field
# Check: events are sorted by score DESC
# Check: response has same shape as normal events + score
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/events/route.ts
git commit -m "feat: add forYou scoring branch to events API"
```

---

### Task 6: Create auth-aware NavLinks component

**Files:**
- Create: `src/components/NavLinks.tsx`
- Modify: `src/app/layout.tsx`

The current layout has nav links as plain `<Link>` in a Server Component. We need a "For You" link visible only to logged-in users, which requires client-side auth state.

- [ ] **Step 1: Create NavLinks component**

Create `src/components/NavLinks.tsx`:

```typescript
"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function NavLinks() {
  const { user } = useAuth();

  return (
    <>
      <Link
        href="/"
        className="text-gray-600 hover:text-gray-900 transition"
      >
        All Events
      </Link>
      <Link
        href="/free-food"
        className="text-green-700 hover:text-green-900 transition"
      >
        Free Food
      </Link>
      {user && (
        <Link
          href="/for-you"
          className="text-blue-700 hover:text-blue-900 transition"
        >
          For You
        </Link>
      )}
    </>
  );
}
```

- [ ] **Step 2: Update layout to use NavLinks**

In `src/app/layout.tsx`, replace the two inline `<Link>` elements (All Events and Free Food) with `<NavLinks />`:

Replace:
```tsx
<Link
  href="/"
  className="text-gray-600 hover:text-gray-900 transition"
>
  All Events
</Link>
<Link
  href="/free-food"
  className="text-green-700 hover:text-green-900 transition"
>
  Free Food
</Link>
```

With:
```tsx
<NavLinks />
```

Add the import at the top:
```typescript
import { NavLinks } from "@/components/NavLinks";
```

Remove the now-unused `Link` import from `next/link` if no other `<Link>` in the file uses it. Check: the "MIT Events" logo link still uses `Link`, so keep the import.

- [ ] **Step 3: Verify**

Run: `npm run dev`
- Not logged in: should see "All Events" and "Free Food" only
- Logged in: should see "All Events", "Free Food", and "For You"

- [ ] **Step 4: Commit**

```bash
git add src/components/NavLinks.tsx src/app/layout.tsx
git commit -m "feat: add auth-aware NavLinks with For You link"
```

---

### Task 7: Create `/for-you` page

**Files:**
- Create: `src/app/for-you/page.tsx`
- Create: `src/app/for-you/client.tsx`

- [ ] **Step 1: Create the server page wrapper**

Create `src/app/for-you/page.tsx`:

```typescript
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
```

- [ ] **Step 2: Create the client component**

Create `src/app/for-you/client.tsx`. This handles all three states:

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { EventCard } from "@/components/EventCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import type { EventDTO } from "@/lib/event";

const PAGE_SIZE = 20;

export function ForYouClient() {
  const { user, loading: authLoading } = useAuth();
  const [interests, setInterests] = useState<string[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Fetch user interests + available topics on mount
  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }

    Promise.all([
      fetch("/api/user/interests").then((r) => r.json()),
      fetch("/api/topics").then((r) => r.json()),
    ])
      .then(([interestsData, topicsData]) => {
        const userInterests: string[] = interestsData.interests ?? [];
        setInterests(userInterests);
        setSelectedTopics(userInterests);
        setAvailableTopics(topicsData.topics ?? []);

        if (userInterests.length > 0) {
          return loadEvents(0);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const loadEvents = (offset: number) => {
    return fetch(
      `/api/events?forYou=true&limit=${PAGE_SIZE}&offset=${offset}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (offset === 0) {
          setEvents(data.events ?? []);
        } else {
          setEvents((prev) => [...prev, ...(data.events ?? [])]);
        }
        setTotal(data.total ?? 0);
      });
  };

  const loadMore = () => {
    setLoadingMore(true);
    loadEvents(events.length).finally(() => setLoadingMore(false));
  };

  const saveInterests = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/interests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selectedTopics }),
      });
      const data = await res.json();
      if (res.ok) {
        setInterests(data.interests);
        setEditing(false);
        setLoading(true);
        await loadEvents(0);
        setLoading(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : prev.length < 10
          ? [...prev, topic]
          : prev
    );
  };

  // --- State 1: Not logged in ---
  if (!authLoading && !user) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Get personalized recommendations
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Log in to see events tailored to your interests.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (authLoading || loading) {
    return <SkeletonCard count={3} />;
  }

  // --- State 2: No interests set / Editing ---
  if (interests.length === 0 || editing) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {editing ? "Edit your interests" : "Pick topics you're interested in"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Select up to 10 topics to personalize your recommendations.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {availableTopics.map((topic) => (
            <button
              key={topic}
              onClick={() => toggleTopic(topic)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                selectedTopics.includes(topic)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={saveInterests}
            disabled={selectedTopics.length === 0 || saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Done"}
          </button>
          {editing && (
            <button
              onClick={() => {
                setSelectedTopics(interests);
                setEditing(false);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          )}
          {selectedTopics.length > 0 && (
            <span className="text-xs text-gray-400">
              {selectedTopics.length}/10 selected
            </span>
          )}
        </div>
      </div>
    );
  }

  // --- State 3: Has interests, show recommendations ---
  return (
    <div>
      {/* Interest tags bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {interests.map((topic) => (
          <span
            key={topic}
            className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
          >
            {topic}
          </span>
        ))}
        <button
          onClick={() => {
            setSelectedTopics(interests);
            setEditing(true);
          }}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          Edit
        </button>
      </div>

      {events.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <p className="text-lg font-medium">
            No recommended events right now
          </p>
          <p className="mt-1 text-sm">Check back soon!</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500">
            {total} recommended event{total !== 1 ? "s" : ""}
          </p>
          <div className="space-y-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          {events.length < total && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore
                  ? "Loading..."
                  : `Load more (showing ${events.length} of ${total})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manual test — all three states**

Run: `npm run dev`, navigate to `/for-you`:

1. **Not logged in:** Should see "Get personalized recommendations" card with login button
2. **Log in, visit `/for-you`:** Should see topic picker (no interests set yet)
3. **Select a few topics, click Done:** Should save and show recommended events sorted by score
4. **Click "Edit":** Should return to picker with previously selected topics pre-checked
5. **Change topics, click Done:** Should refresh recommendations

- [ ] **Step 4: Commit**

```bash
git add src/app/for-you/page.tsx src/app/for-you/client.tsx
git commit -m "feat: add /for-you page with interest picker and recommendations"
```

---

### Task 8: Final integration verification

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Successful build with no type errors

- [ ] **Step 3: End-to-end manual walkthrough**

1. Visit homepage — nav shows "All Events", "Free Food" (no "For You" — not logged in)
2. Log in — nav now shows "For You"
3. Click "For You" — see interest picker
4. Select topics → Done — see recommended events with highest-scored first
5. Bookmark a few events → refresh `/for-you` — scoring should shift slightly based on bookmarked topics
6. Click "Edit" → change interests → Done — recommendations update

- [ ] **Step 4: Commit any fixes from verification**

```bash
git add -A
git commit -m "fix: address issues from integration testing"
```

(Skip this commit if no fixes needed.)
