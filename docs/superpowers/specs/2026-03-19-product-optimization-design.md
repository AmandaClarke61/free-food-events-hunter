# Product Optimization Design

**Date:** 2026-03-19
**Scope:** Round 1 (Security + Critical UX) + Round 2 (Experience Polish)
**Total items:** 10

---

## Round 1: Security + Critical UX

### 1.1 JWT_SECRET Production Guard

**File:** `src/lib/auth.ts`

**Problem:** `JWT_SECRET` falls back to `"dev-secret-change-me"` silently in production.

**Change:** When `NODE_ENV === 'production'` and `JWT_SECRET` is not set, throw an error at module load time to prevent the app from starting with an insecure secret. Keep the dev fallback for local development.

```ts
const JWT_SECRET = process.env.NODE_ENV === 'production'
  ? (() => { if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET required in production'); return process.env.JWT_SECRET; })()
  : (process.env.JWT_SECRET || 'dev-secret-change-me');
```

### 1.2 Email Verification Rate Limiting

**File:** `src/app/api/auth/register/route.ts`

**Problem:** No limit on verification code requests per email. Can be abused for spam or brute force. The current code runs `deleteMany` on existing codes before creating a new one, so a naive "check for existing code" would always find nothing.

**Change:** The rate-limit check must be placed **before** the `deleteMany` call. Ordering:
1. Query `VerificationCode` for this email where `createdAt > now - 5 minutes`.
2. If found, return HTTP 429: "Verification code already sent. Please check your email or wait 5 minutes."
3. Only then proceed with `deleteMany` + create new code + send email.

No new dependencies needed.

### 1.3 Bookmark Failure Toast

**Files:**
- New: `src/components/Toast.tsx`
- Modified: `src/components/BookmarkButton.tsx`

**Problem:** Bookmark toggle fails silently - UI reverts but user gets no feedback.

**Change:**
- Create a lightweight Toast component: fixed-position div at bottom-center, red background for errors, auto-dismisses after 3 seconds via `setTimeout`. Pure CSS animation (fade in/out). No third-party library.
- In BookmarkButton's catch block, render the Toast with "Bookmark failed, please try again."
- Toast state managed locally in BookmarkButton (simple `useState`).
- **Important:** BookmarkButton is rendered inside an `<a>` tag in EventCard. Use `createPortal(toast, document.body)` to render the Toast at document root, avoiding invalid DOM nesting and click-propagation issues.

### 1.4 Search Input Validation + Debounce

**File:** `src/components/FilterBar.tsx`

**Problem:** No input length limit, no debounce. Long strings could degrade performance.

**Changes:**
- Add `maxLength={100}` to search input.
- Convert search input from uncontrolled (`defaultValue`) to controlled (`value` + `useState` + `onChange`). This is required for the debounce to observe input changes.
- Add 300ms debounce: `onChange` updates local state immediately, a `useEffect` watching the local state sets a 300ms timer to update URL params. Implement with `setTimeout`/`clearTimeout`, no library needed.
- Keep Enter key for immediate search (clears debounce timer and fires immediately).

### 1.5 LLM Retry + Result Cache

**File:** `src/classify/llm.ts`
**Schema:** Add `LlmCache` model to `prisma/schema.prisma`

**Problem:** API failure returns neutral results (confidence 0.5), potentially missing free food events. Identical events re-classified on every pipeline run.

**Changes:**

**Retry logic:**
- On API call failure, retry up to 2 times with exponential backoff (1s, 2s).
- Simple async helper: `retryWithBackoff(fn, maxRetries=2)`.
- After all retries exhausted, fall back to current neutral result behavior.

**Cache:**
- New Prisma model:
  ```prisma
  model LlmCache {
    id          String   @id @default(cuid())
    fingerprint String   @unique
    result      String   // JSON stringified classification result
    createdAt   DateTime @default(now())
  }
  ```
- **Fingerprint algorithm for cache:** Hash `title + description.slice(0,300) + location` (matching exactly what gets sent to the LLM), distinct from the Event fingerprint which uses title+date. Compute inside `classifyWithLLM`.
- **Cache layer placement:** Add cache logic inside `classifyWithLLM` itself. The function receives `EventInput[]`, computes cache fingerprints for each, does a bulk `findMany({ where: { fingerprint: { in: [...] } } })` to fetch all hits, then only sends cache-misses to OpenAI. After successful API response, bulk-upsert results into cache.
- Cache TTL: 7 days. Stale entries cleaned up at the start of each pipeline run (`deleteMany({ where: { createdAt: { lt: 14 days ago } } })`).

---

## Round 2: Experience Polish

### 2.1 Mobile Calendar Improvement

**File:** `src/components/CalendarView.tsx`

**Problem:** Mobile shows only colored dots, low information density. No scroll-to-detail on tap.

**Changes:**
- Add a `ref` (or `id`) to the event list section below the calendar grid.
- On date click (mobile), call `ref.current.scrollIntoView({ behavior: 'smooth' })` to scroll to the event list.
- Selected date gets a more prominent highlight: colored ring background instead of just text color change.
- Free food days: change green dot to a slightly larger green ring for better visibility.

### 2.2 Homepage Skeleton Loading

**Files:**
- New: `src/components/SkeletonCard.tsx`
- Modified: `src/app/page.tsx`, `src/app/free-food/page.tsx`

**Problem:** Suspense fallback shows nothing, feels like the page is broken on slow connections.

**Change:**
- Extract the existing skeleton card markup from `src/app/free-food/client.tsx` into a shared `SkeletonCard` component that accepts a `count` prop (default 3) and renders that many skeleton cards.
- Use `<SkeletonCard count={6} />` as the Suspense fallback in both the homepage and free-food page.
- Update `client.tsx` to use the shared component instead of inline skeleton markup.
- Skeleton: gray animated pulse rectangles mimicking EventCard layout (title bar, date bar, description lines).

### 2.3 Dynamic Topic List

**Files:**
- New: `src/app/api/topics/route.ts`
- Modified: `src/components/FilterBar.tsx`

**Problem:** 13 topics hard-coded. New topics from LLM classification won't appear.

**Changes:**
- New API endpoint `GET /api/topics`: The `topics` field is stored as a JSON-stringified string (e.g. `'["career","social"]'`), not a relational column. Implementation: query all non-null `topics` values, JSON-parse each, flatten into a `Set`, sort, and return as array. The 5-minute in-memory cache mitigates the cost of scanning all events.
- Simple in-memory cache (module-level variable with timestamp), 5-minute TTL. Invalidated naturally by staleness.
- FilterBar fetches `/api/topics` on mount, renders buttons dynamically.
- Fallback: if fetch fails, use current hard-coded list as default.

### 2.4 Image Lazy Loading

**File:** `src/components/EventCard.tsx`

**Problem:** All event images load immediately, wastes bandwidth on long lists.

**Change:** Add `loading="lazy"` attribute to the `<img>` tag. One-line change. Consider switching to Next.js `<Image>` component for automatic size optimization if images have predictable dimensions.

### 2.5 Past Event Indicator

**File:** `src/components/EventCard.tsx`

**Problem:** Past events (visible via calendar or search) look identical to upcoming events.

**Change:**
- Compare `event.startTime` with current time (client-side, approximate — acceptable for visual dimming, not access control).
- If past: add gray "Ended" badge next to the date, apply `opacity-60` to the entire card.
- Keeps past events visible but clearly distinguishable from upcoming ones.

---

## Dependencies

All 10 items are independent of each other. They can be implemented in any order within each round. The only shared artifact is `SkeletonCard.tsx` (2.2), which is new and doesn't block anything.

Round 1 should be completed before Round 2 since it addresses security issues.

## Schema Changes

Only one schema change required:
- `LlmCache` model (item 1.5)

Run `npx prisma db push` after adding the model.

## New Files

| File | Item |
|------|------|
| `src/components/Toast.tsx` | 1.3 |
| `src/components/SkeletonCard.tsx` | 2.2 |
| `src/app/api/topics/route.ts` | 2.3 |

## Modified Files

| File | Items |
|------|-------|
| `src/lib/auth.ts` | 1.1 |
| `src/app/api/auth/register/route.ts` | 1.2 |
| `src/components/BookmarkButton.tsx` | 1.3 |
| `src/components/FilterBar.tsx` | 1.4, 2.3 |
| `src/classify/llm.ts` | 1.5 |
| `prisma/schema.prisma` | 1.5 |
| `src/components/CalendarView.tsx` | 2.1 |
| `src/app/page.tsx` | 2.2 |
| `src/app/free-food/page.tsx` | 2.2 |
| `src/app/free-food/client.tsx` | 2.2 |
| `src/components/EventCard.tsx` | 2.4, 2.5 |
