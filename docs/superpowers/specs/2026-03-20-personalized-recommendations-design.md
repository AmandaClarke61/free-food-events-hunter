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

No new tables. Implicit signals are derived at query time from the existing `Bookmark` + `Event.topics` data.

## Scoring Logic (`recommend/score.ts`)

Refactor the existing `scoreEvent()` function. Inputs:

- **Explicit interests**: topics from `User.interests`
- **Implicit interests**: topic frequency map derived from user's bookmarked events (`{ topic: count }`)
- **Event attributes**: `hasFreeFood`, `foodConfidence`, `topics`, `startTime`

Scoring rules (approximate max ~100):

| Signal | Points | Notes |
|--------|--------|-------|
| Explicit interest match | +25 per matching topic | Highest weight — user chose these |
| Implicit interest match | +5 x bookmark count per topic (cap 15) | Prevents single-topic domination |
| Free food | +30 x foodConfidence | Universal appeal, keep existing logic |
| Time proximity | Up to +20 within 48h | Keep existing decay logic |

Sort: score DESC, then startTime ASC for ties.

## API Changes

### `PUT /api/user/interests`

- Auth: required (JWT)
- Request body: `{ "interests": ["research", "career", "social"] }`
- Validation: interests must be an array of strings, max 10 items, each must be a known topic
- Response: `{ "interests": ["research", "career", "social"] }`
- Updates `User.interests` field

### `GET /api/events?forYou=true`

- Auth: required (returns 401 if not logged in)
- Flow:
  1. Fetch user's `interests` from User record
  2. Aggregate topic frequency from user's bookmarked events: `SELECT topics FROM Event JOIN Bookmark WHERE userId = ?`
  3. Fetch upcoming events (reuse existing where-clause logic)
  4. Score each event with `scoreEvent()`
  5. Sort by score DESC, startTime ASC
  6. Return paginated results
- Response: same as existing `/api/events` format, plus `score: number` on each event
- When `forYou=true`: topic filter param is ignored (recommendations are multi-topic by nature). Other filters (search, date, freeFood) still apply.

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

### Navigation

Add "For You" link in the top nav bar, same level as "Free Food". Visible only to logged-in users.

## What This Does NOT Include

- Collaborative filtering or matrix factorization
- Click/view tracking (only bookmarks as implicit signal)
- Push notifications for recommended events
- A/B testing of scoring weights
- Settings page (interests are managed inline on the For You page)
