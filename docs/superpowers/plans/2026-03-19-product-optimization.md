# Product Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix security vulnerabilities and polish UX across 10 independent items in 2 rounds.

**Architecture:** All 10 changes are independent — no shared state or ordering dependencies within a round. Round 1 (security) should complete before Round 2 (UX). Each task modifies 1-3 files max.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma 5 + SQLite/Turso, Tailwind CSS, React 18.

**Spec:** `docs/superpowers/specs/2026-03-19-product-optimization-design.md`

---

## File Structure

No new directories. New files:

| File | Purpose |
|------|---------|
| `src/components/Toast.tsx` | Lightweight toast notification component |
| `src/components/SkeletonCard.tsx` | Shared skeleton loading card |
| `src/app/api/topics/route.ts` | Dynamic topic list API endpoint |

Modified files: `src/lib/auth.ts`, `src/app/api/auth/register/route.ts`, `src/components/BookmarkButton.tsx`, `src/components/FilterBar.tsx`, `src/classify/llm.ts`, `prisma/schema.prisma`, `src/pipeline/run.ts`, `src/components/CalendarView.tsx`, `src/app/page.tsx`, `src/app/free-food/page.tsx`, `src/app/free-food/client.tsx`, `src/components/EventCard.tsx`

---

## Round 1: Security + Critical UX

### Task 1: JWT_SECRET Production Guard

**Files:**
- Modify: `src/lib/auth.ts:6`

- [ ] **Step 1: Replace the JWT_SECRET declaration**

In `src/lib/auth.ts`, replace line 6:

```ts
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
```

with:

```ts
const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return "dev-secret-change-me";
})();
```

- [ ] **Step 2: Verify dev server still starts**

Run: `cd "/Users/liuyi/Documents/Projects/assignment/free food events hunter" && npx next build 2>&1 | head -5`

Expected: Build succeeds (no JWT_SECRET needed in dev/build).

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "fix: require JWT_SECRET in production environment"
```

---

### Task 2: Email Verification Rate Limiting

**Files:**
- Modify: `src/app/api/auth/register/route.ts:44-52`

- [ ] **Step 1: Add rate limit check before deleteMany**

In `src/app/api/auth/register/route.ts`, insert the following code **after** line 42 (`await prisma.user.create(...)`) and **before** line 44 (`const code = ...`):

```ts
    // Rate limit: check for existing unexpired code
    const recentCode = await prisma.verificationCode.findFirst({
      where: {
        email,
        createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    if (recentCode) {
      return NextResponse.json(
        { error: "Verification code already sent. Please check your email or wait 5 minutes." },
        { status: 429 }
      );
    }
```

The existing `deleteMany` (line 49) and code creation remain unchanged after this block.

- [ ] **Step 2: Verify the route still works**

Run: `cd "/Users/liuyi/Documents/Projects/assignment/free food events hunter" && npx tsc --noEmit src/app/api/auth/register/route.ts 2>&1 | head -10`

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "fix: add rate limiting to email verification code requests"
```

---

### Task 3: Bookmark Failure Toast

**Files:**
- Create: `src/components/Toast.tsx`
- Modify: `src/components/BookmarkButton.tsx`

- [ ] **Step 1: Create Toast component**

Create `src/components/Toast.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // wait for fade-out
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return createPortal(
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-red-600 px-4 py-2.5 text-sm text-white shadow-lg transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {message}
    </div>,
    document.body
  );
}
```

- [ ] **Step 2: Add toast state to BookmarkButton**

In `src/components/BookmarkButton.tsx`, add the import and state:

Add at the top imports:
```tsx
import { Toast } from "./Toast";
```

Add state inside the component (after line 17 `const [loading, setLoading] = useState(false);`):
```tsx
  const [toastMessage, setToastMessage] = useState<string | null>(null);
```

In the `catch` block (line 43-44), replace `setBookmarked(bookmarked); // revert` with:
```tsx
      setBookmarked(bookmarked); // revert
      setToastMessage("Bookmark failed, please try again.");
```

Also in the `else` branch (line 41), add the toast:
```tsx
        setBookmarked(bookmarked); // revert
        setToastMessage("Bookmark failed, please try again.");
```

Before the closing `</button>` tag in the return, add (after the `</button>` closing, inside the fragment):

Wrap the return in a fragment and add Toast:
```tsx
  return (
    <>
      <button
        onClick={toggle}
        disabled={loading}
        title={bookmarked ? "Remove bookmark" : "Bookmark this event"}
        className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 transition disabled:opacity-50"
      >
        <svg ...existing svg... />
      </button>
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </>
  );
```

- [ ] **Step 3: Verify build**

Run: `cd "/Users/liuyi/Documents/Projects/assignment/free food events hunter" && npx tsc --noEmit 2>&1 | head -10`

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Toast.tsx src/components/BookmarkButton.tsx
git commit -m "feat: add toast notification on bookmark failure"
```

---

### Task 4: Search Input Validation + Debounce

**Files:**
- Modify: `src/components/FilterBar.tsx:49-61`

- [ ] **Step 1: Convert to controlled input with debounce**

In `src/components/FilterBar.tsx`:

Add `useState, useEffect` to the import (line 3 already has `useCallback`, add the others):
```tsx
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
```

Inside the `FilterBar` function, after the `hasActiveFilters` line (line 22), add:

```tsx
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync from URL -> local state when searchParams change externally
  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  // Debounce: auto-search 300ms after typing stops
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const current = searchParams.get("search") ?? "";
      if (searchInput !== current) {
        updateParams({ search: searchInput || null });
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps
```

Replace the search `<input>` element (lines 50-60) with:

```tsx
          <input
            type="text"
            placeholder="Search events..."
            value={searchInput}
            maxLength={100}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (debounceRef.current) clearTimeout(debounceRef.current);
                updateParams({ search: searchInput || null });
              }
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
```

- [ ] **Step 2: Verify build**

Run: `cd "/Users/liuyi/Documents/Projects/assignment/free food events hunter" && npx tsc --noEmit 2>&1 | head -10`

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/FilterBar.tsx
git commit -m "feat: add search input debounce and max length validation"
```

---

### Task 5: LLM Retry + Result Cache

**Files:**
- Modify: `prisma/schema.prisma` (add LlmCache model)
- Modify: `src/classify/llm.ts` (add retry + cache)
- Modify: `src/pipeline/run.ts` (add cache cleanup)

- [ ] **Step 1: Add LlmCache model to Prisma schema**

In `prisma/schema.prisma`, add after the `PipelineRun` model (after line 92):

```prisma
model LlmCache {
  id          String   @id @default(cuid())
  fingerprint String   @unique
  result      String   // JSON stringified LLM classification result
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 2: Push schema**

Run: `cd "/Users/liuyi/Documents/Projects/assignment/free food events hunter" && npx prisma db push`

Expected: Schema synced, LlmCache table created.

- [ ] **Step 3: Add retry helper and cache logic to llm.ts**

Replace the entire content of `src/classify/llm.ts` with:

```ts
import crypto from "crypto";
import OpenAI from "openai";
import { prisma } from "@/lib/db";

const openai = new OpenAI();

interface LLMClassification {
  hasFreeFood: boolean;
  confidence: number;
  foodDetails?: string;
  topics: string[];
}

interface EventInput {
  title: string;
  description?: string;
  location?: string;
}

/** Compute a cache fingerprint from the text sent to the LLM */
function cacheFingerprint(e: EventInput): string {
  const text = `${e.title}|${(e.description ?? "").slice(0, 300)}|${e.location ?? ""}`;
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/** Retry a function with exponential backoff */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Batch-classify events using gpt-4o-mini.
 * Uses cache to skip previously classified events and retries on failure.
 */
export async function classifyWithLLM(
  events: EventInput[]
): Promise<LLMClassification[]> {
  if (events.length === 0) return [];

  const neutralResult = (): LLMClassification => ({
    hasFreeFood: false,
    confidence: 0.5,
    topics: [],
  });

  if (!process.env.OPENAI_API_KEY) {
    return events.map(() => neutralResult());
  }

  // Compute fingerprints and check cache
  const fingerprints = events.map(cacheFingerprint);
  const cached = await prisma.llmCache.findMany({
    where: {
      fingerprint: { in: fingerprints },
      createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });
  const cacheMap = new Map(cached.map((c) => [c.fingerprint, c.result]));

  // Separate hits from misses
  const results: LLMClassification[] = new Array(events.length);
  const missIndices: number[] = [];

  for (let i = 0; i < events.length; i++) {
    const cachedResult = cacheMap.get(fingerprints[i]);
    if (cachedResult) {
      results[i] = JSON.parse(cachedResult);
    } else {
      missIndices.push(i);
    }
  }

  if (missIndices.length === 0) return results;

  // Call OpenAI for cache misses only
  const missEvents = missIndices.map((i) => events[i]);
  const eventList = missEvents
    .map(
      (e, i) =>
        `[${i}] Title: ${e.title}\nDescription: ${(e.description ?? "").slice(0, 300)}\nLocation: ${e.location ?? "N/A"}`
    )
    .join("\n\n");

  let llmResults: LLMClassification[];
  try {
    const response = await retryWithBackoff(() =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You analyze MIT campus events. For each event, determine:
1. Whether free food is available (hasFreeFood: boolean)
2. Confidence level 0-1 (foodConfidence: number)
3. Food details if applicable (foodDetails: string or null)
4. 1-3 topic tags from: [academics, social, career, research, workshop, sports, arts, health, diversity, technology, entrepreneurship, community, seminar, networking] (topics: string[])

Respond with JSON: {"results": [{"hasFreeFood": bool, "confidence": float, "foodDetails": str|null, "topics": [str]}]}`,
          },
          {
            role: "user",
            content: `Classify these ${missEvents.length} events:\n\n${eventList}`,
          },
        ],
      })
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      llmResults = missEvents.map(() => neutralResult());
    } else {
      const parsed = JSON.parse(content) as {
        results: Array<{
          hasFreeFood: boolean;
          confidence: number;
          foodDetails?: string | null;
          topics: string[];
        }>;
      };
      llmResults = parsed.results.map((r) => ({
        hasFreeFood: r.hasFreeFood,
        confidence: r.confidence,
        foodDetails: r.foodDetails ?? undefined,
        topics: r.topics ?? [],
      }));
    }
  } catch (err) {
    console.error("[llm] All retries failed:", err);
    llmResults = missEvents.map(() => neutralResult());
  }

  // Store results in cache and fill in the results array
  for (let j = 0; j < missIndices.length; j++) {
    const idx = missIndices[j];
    results[idx] = llmResults[j] ?? neutralResult();

    // Upsert to cache (fire and forget)
    prisma.llmCache
      .upsert({
        where: { fingerprint: fingerprints[idx] },
        update: { result: JSON.stringify(results[idx]), createdAt: new Date() },
        create: { fingerprint: fingerprints[idx], result: JSON.stringify(results[idx]) },
      })
      .catch((err) => console.error("[llm] Cache write failed:", err));
  }

  return results;
}

/** Extract topics using simple keyword matching (no LLM needed) */
export function extractTopicsByRules(title: string, description?: string): string[] {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  const topics: string[] = [];

  const topicPatterns: Record<string, RegExp> = {
    academics: /\b(lecture|class|course|seminar|thesis|dissertation|academic)\b/,
    career: /\b(career|job|intern|recruit|hiring|resume|interview|employer)\b/,
    research: /\b(research|paper|study|lab|poster|phd|thesis)\b/,
    workshop: /\b(workshop|hands-on|tutorial|training|bootcamp|hackathon)\b/,
    social: /\b(social|mixer|party|hangout|game\s*night|movie|trivia|karaoke)\b/,
    sports: /\b(sports|fitness|yoga|run|marathon|basketball|soccer|gym|intramural)\b/,
    arts: /\b(art|music|concert|performance|theater|theatre|gallery|dance|film)\b/,
    health: /\b(health|wellness|mental\s*health|meditation|counseling|mindful)\b/,
    diversity: /\b(diversity|inclusion|dei|equity|cultural|heritage|pride|lgbtq)\b/,
    technology: /\b(tech|software|coding|programming|ai|machine\s*learning|data\s*science|robotics|cyber)\b/,
    entrepreneurship: /\b(startup|entrepreneur|venture|pitch|founder|innovation|business\s*plan)\b/,
    community: /\b(community|volunteer|service|outreach|charity|fundrais)\b/,
    networking: /\b(networking|connect|meetup|meet\s*and\s*greet|alumni)\b/,
  };

  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(text)) topics.push(topic);
  }

  if (topics.length === 0) topics.push("community");
  return topics.slice(0, 3);
}
```

- [ ] **Step 4: Add cache cleanup to pipeline run**

In `src/pipeline/run.ts`, add at the beginning of the `runPipeline` function (after line 36 `const allRawEvents: RawEvent[] = [];`):

```ts
  // Clean up stale LLM cache entries (older than 14 days)
  await prisma.llmCache.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
  }).catch((err) => console.error("[pipeline] LLM cache cleanup failed:", err));
```

- [ ] **Step 5: Verify build**

Run: `cd "/Users/liuyi/Documents/Projects/assignment/free food events hunter" && npx prisma generate && npx tsc --noEmit 2>&1 | head -10`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/classify/llm.ts src/pipeline/run.ts
git commit -m "feat: add LLM retry with backoff and result caching"
```

---

## Round 2: Experience Polish

### Task 6: Mobile Calendar Improvement

**Files:**
- Modify: `src/components/CalendarView.tsx`

- [ ] **Step 1: Add ref and scroll behavior**

In `src/components/CalendarView.tsx`:

Add `useRef` to the imports (line 1 already has `useEffect, useState, useMemo, useCallback` — add `useRef`):

```tsx
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
```

Inside the component, add a ref (after the `selectedDate` state on line 32):

```tsx
  const eventListRef = useRef<HTMLDivElement>(null);
```

Update `handleDateClick` (lines 97-103) to add scroll behavior:

```tsx
  const handleDateClick = useCallback(
    (day: number) => {
      const key = toDateKey(new Date(month.getFullYear(), month.getMonth(), day));
      setSelectedDate((prev) => {
        const newVal = prev === key ? null : key;
        if (newVal && eventListRef.current) {
          setTimeout(() => eventListRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
        return newVal;
      });
    },
    [month]
  );
```

- [ ] **Step 2: Improve date highlight and free food dot**

Replace the date button styling (line 158-160). Change the `className` of the date `<button>`:

```tsx
              className={`bg-white min-h-[80px] sm:min-h-[100px] p-1.5 text-left transition hover:bg-gray-50 ${
                isToday ? "bg-blue-50" : ""
              } ${isSelected ? "ring-2 ring-inset ring-blue-500 bg-blue-50" : ""}`}
```

Replace the free food dot (line 172-174). Change from small dot to ring:

```tsx
                    {hasFreeFoodEvent && (
                      <span className="h-2 w-2 rounded-full border-2 border-green-500 bg-green-100" />
                    )}
```

- [ ] **Step 3: Add ref to event list section**

On the selected day events container (line 202), add the ref:

```tsx
      {selectedDate && (
        <div className="mt-6" ref={eventListRef}>
```

- [ ] **Step 4: Verify build**

Run: `cd "/Users/liuyi/Documents/Projects/assignment/free food events hunter" && npx tsc --noEmit 2>&1 | head -10`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/CalendarView.tsx
git commit -m "feat: improve mobile calendar UX with scroll-to-detail and better indicators"
```

---

### Task 7: Homepage Skeleton Loading

**Files:**
- Create: `src/components/SkeletonCard.tsx`
- Modify: `src/app/free-food/client.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/free-food/page.tsx`

- [ ] **Step 1: Create shared SkeletonCard component**

Create `src/components/SkeletonCard.tsx`:

```tsx
export function SkeletonCard({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex gap-3">
            <div className="h-20 w-20 rounded-md bg-gray-200 flex-shrink-0" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-4 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-200" />
              <div className="h-3 w-full rounded bg-gray-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update free-food client to use shared SkeletonCard**

In `src/app/free-food/client.tsx`:

Remove the local `SkeletonCard` function (lines 9-22).

Add import at the top:
```tsx
import { SkeletonCard } from "@/components/SkeletonCard";
```

Replace the loading block (lines 51-59) with:
```tsx
  if (loading) {
    return <SkeletonCard count={3} />;
  }
```

- [ ] **Step 3: Add skeleton fallback to homepage**

In `src/app/page.tsx`, add import:
```tsx
import { SkeletonCard } from "@/components/SkeletonCard";
```

Replace `<Suspense>` (line 15) with:
```tsx
      <Suspense fallback={<SkeletonCard count={6} />}>
```

- [ ] **Step 4: Add skeleton fallback to free-food page**

In `src/app/free-food/page.tsx`, add import:
```tsx
import { SkeletonCard } from "@/components/SkeletonCard";
```

Replace `<Suspense>` (line 14) with:
```tsx
      <Suspense fallback={<SkeletonCard count={6} />}>
```

- [ ] **Step 5: Verify build**

Run: `cd "/Users/liuyi/Documents/Projects/assignment/free food events hunter" && npx tsc --noEmit 2>&1 | head -10`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/SkeletonCard.tsx src/app/free-food/client.tsx src/app/page.tsx src/app/free-food/page.tsx
git commit -m "feat: add skeleton loading cards to homepage and free-food page"
```

---

### Task 8: Dynamic Topic List

**Files:**
- Create: `src/app/api/topics/route.ts`
- Modify: `src/components/FilterBar.tsx`

- [ ] **Step 1: Create topics API endpoint**

Create `src/app/api/topics/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

let cachedTopics: string[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const now = Date.now();
  if (cachedTopics && now - cacheTime < CACHE_TTL) {
    return NextResponse.json({ topics: cachedTopics });
  }

  const events = await prisma.event.findMany({
    where: { topics: { not: null } },
    select: { topics: true },
  });

  const topicSet = new Set<string>();
  for (const e of events) {
    try {
      const parsed = JSON.parse(e.topics!) as string[];
      for (const t of parsed) topicSet.add(t);
    } catch {
      // skip malformed JSON
    }
  }

  cachedTopics = [...topicSet].sort();
  cacheTime = now;

  return NextResponse.json({ topics: cachedTopics });
}
```

- [ ] **Step 2: Update FilterBar to fetch topics dynamically**

In `src/components/FilterBar.tsx`:

Keep the `TOPICS` array as fallback, but rename it:
```tsx
const DEFAULT_TOPICS = [
  "academics", "career", "social", "research", "workshop",
  "technology", "arts", "sports", "health", "networking",
  "entrepreneurship", "community", "diversity",
];
```

Inside the `FilterBar` component, add state and fetch (after the `hasActiveFilters` line):

```tsx
  const [topics, setTopics] = useState(DEFAULT_TOPICS);

  useEffect(() => {
    fetch("/api/topics")
      .then((r) => r.json())
      .then((data) => {
        if (data.topics?.length > 0) setTopics(data.topics);
      })
      .catch(() => {}); // keep defaults on error
  }, []);
```

Replace `{TOPICS.map(` (line 85) with `{topics.map(`.

- [ ] **Step 3: Verify build**

Run: `cd "/Users/liuyi/Documents/Projects/assignment/free food events hunter" && npx tsc --noEmit 2>&1 | head -10`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/topics/route.ts src/components/FilterBar.tsx
git commit -m "feat: dynamic topic list fetched from database"
```

---

### Task 9: Image Lazy Loading

**Files:**
- Modify: `src/components/EventCard.tsx:51-55`

- [ ] **Step 1: Add loading="lazy" to img tag**

In `src/components/EventCard.tsx`, update the `<img>` tag (line 52) to add `loading="lazy"`:

```tsx
          <img
            src={event.imageUrl}
            alt=""
            loading="lazy"
            className="h-20 w-20 rounded-md object-cover flex-shrink-0"
          />
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EventCard.tsx
git commit -m "feat: lazy load event card images"
```

---

### Task 10: Past Event Indicator

**Files:**
- Modify: `src/components/EventCard.tsx`

- [ ] **Step 1: Add past event detection and styling**

In `src/components/EventCard.tsx`, inside the `EventCard` function, after `const dateLabel = relativeDate(start);` (line 35), add:

```tsx
  const isPast = start.getTime() < Date.now();
```

Update the outermost `<a>` tag (line 43) to conditionally apply opacity:

```tsx
    <a
      href={event.url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-gray-300 ${
        isPast ? "opacity-60" : ""
      }`}
    >
```

In the date/time display area (line 76), add an "Ended" badge:

```tsx
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
```

- [ ] **Step 2: Verify build**

Run: `cd "/Users/liuyi/Documents/Projects/assignment/free food events hunter" && npx tsc --noEmit 2>&1 | head -10`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/EventCard.tsx
git commit -m "feat: add past event indicator with 'Ended' badge and dimmed styling"
```

---

## Final Verification

- [ ] **Full build check**

Run: `cd "/Users/liuyi/Documents/Projects/assignment/free food events hunter" && npm run build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Manual smoke test**

1. Start dev server: `npm run dev`
2. Visit `/` — verify skeleton loading shows, search debounce works, topics load dynamically
3. Visit `/free-food` — verify skeleton loading shows
4. Test calendar view on mobile viewport — verify scroll-to-detail works
5. Test bookmark toggle with network disabled — verify toast appears
6. Check event cards show lazy loading images and "Ended" badges for past events
