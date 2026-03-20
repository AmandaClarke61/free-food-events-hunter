# Personalized Recommendations Design

## Overview

Add a lightweight personalized recommendation system to the Free Food Events Hunter. Users get a `/for-you` page that ranks events based on explicit interest tags and implicit bookmark behavior. No heavy recommendation algorithms — just weighted scoring on existing data.

## Data Model

Add one field to the existing `User` model:

```prisma
model User {
  // ...existing fields...
  interests String? // JSON array of topic strings, e.g. '["research","career"]'
}
```

After adding the field, run: `npx prisma db push` (SQLite, nullable field — no data migration needed).

No new tables. Implicit signals are derived at query time from the existing `Bookmark` + `Event.topics` data.

## Scoring Logic (`recommend/score.ts`)

Replace the existing `scoreEvent()` function entirely. The current `ScoringInput` and `UserPreferences` interfaces are superseded by:

```typescript
interface ScoringEvent {
  hasFreeFood: boolean;
  foodConfidence: number;
  topics: string[];
  startTime: Date;
}

interface UserPreferences {
  explicitInterests: string[];               // from User.interests
  implicitInterests: Record<string, number>; // topic -> bookmark count
}
```

The old `prefersFreeFood` boolean is removed — free food scoring is now unconditional (everyone benefits from free food on campus).

Scoring rules (approximate max ~100):

| Signal | Points | Notes |
|--------|--------|-------|
| Explicit interest match | +25 per matching topic | Highest weight — user chose these |
| Implicit interest match | +5 x bookmark count per topic (cap 15) | Prevents single-topic domination |
| Free food | +30 x foodConfidence | Unconditional for all users |
| Time proximity | Up to +20 within 48h | Keep existing decay logic |

Sort: score DESC, then startTime ASC for ties.

## API Changes

### `PUT /api/user/interests`

New route file: `src/app/api/user/interests/route.ts`

- Auth: required (JWT)
- Request body: `{ "interests": ["research", "career", "social"] }`
- Validation: interests must be an array of non-empty strings, max 10 items, max 50 chars each. No strict topic validation against the database (topics change over time as events are ingested).
- Response: `{ "interests": ["research", "career", "social"] }`
- Updates `User.interests` field

### `GET /api/events?forYou=true`

- Auth: required (returns 401 if not logged in)
- Always returns upcoming events only (`startTime >= now`)
- Flow:
  1. Query user record with `prisma.user.findUnique()` to get `interests` (do NOT modify `getCurrentUser()` — keep that lightweight for general auth checks)
  2. Aggregate topic frequency from user's bookmarked events: query Bookmark + Event, parse each event's topics JSON, count occurrences
  3. Fetch ALL upcoming events (no `skip`/`take` at DB level — scoring requires the full set)
  4. Score each event with `scoreEvent()`
  5. Sort by score DESC, startTime ASC
  6. Slice in application code for pagination (`offset` / `limit`)
  7. Return paginated results
- Response: same as existing `/api/events` format, plus `score: number` on each event. Add optional `score` field to event type in `src/lib/event.ts`.
- When `forYou=true`: topic filter param is ignored (recommendations are multi-topic by nature); `upcoming` param is also ignored (always treated as true). Other filters (search, date, freeFood) still apply.
- `foodConfidence` is used server-side only (from the Prisma model) for scoring. It does not need to appear in the client-facing `EventDTO`.

Note: In-memory pagination is fine for this dataset size (hundreds of events, not thousands).

## Frontend

### `/for-you` page

Three states based on user context:

**State 1 — Not logged in:**
Simple card: "Log in to get personalized recommendations" with a login button.

**State 2 — Logged in, no interests set:**
Interest picker card:
- Title: "Pick topics you're interested in"
- Display all available topics as clickable tags (fetched from `/api/topics`)
- "Done" button calls `PUT /api/user/interests`, then loads recommendations

**State 3 — Logged in, has interests:**
- Top bar showing current interest tags with an "Edit" button (clicking returns to picker mode)
- Event list using existing `EventCard` component, fed by `GET /api/events?forYou=true`
- Pagination support (same pattern as homepage)
- Empty state: "No recommended events right now — check back soon!" when scoring returns zero results

### Navigation

Add "For You" link in the top nav bar, same level as "Free Food". The link must be rendered in a Client Component that reads from `AuthContext` (similar to how `UserMenu` works), since the layout is a Server Component. Visible only to logged-in users.

## What This Does NOT Include

- Collaborative filtering or matrix factorization
- Click/view tracking (only bookmarks as implicit signal)
- Push notifications for recommended events
- A/B testing of scoring weights
- Settings page (interests are managed inline on the For You page)
