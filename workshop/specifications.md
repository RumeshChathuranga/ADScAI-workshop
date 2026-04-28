# 🕐 Pickup Time Slots — Feature Specification

**Project:** ADScAI Canteen Workshop  
**Date:** 2026-04-28  
**Status:** Approved for implementation  

---

## Why This Feature, And Why First

Among the three identified weakpoints, **pickup time slots** has the highest expected impact on ordering volume. Here is the reasoning:

| Solution | Students affected | Difficulty | Expected ordering lift |
|---|---|---|---|
| Pickup time slots | Every single student | Medium | ★★★★★ |
| Real-time stock visibility | Every single student | Medium | ★★★★☆ |
| Dietary tags | ~30–40% of students | Low | ★★★☆☆ |

Pickup time slots wins because it removes the **single biggest reason students skip the canteen entirely**: time risk. A student who doesn't know whether they'll wait 5 minutes or 35 minutes will simply not bother. Once they can commit to a specific pickup window from their phone or laptop — before they even leave their seat — the canteen becomes a reliable, low-friction option.

Critically, the app already markets itself as a pre-ordering system. The existing page copy reads: *"Pre-order now — pick it up hot and skip the line."* The infrastructure intent is there. This feature delivers on that promise.

The other two solutions are valuable follow-ups but do not address the core ordering drop-off on their own.

---

## 1. Goal

Allow students to select a 15-minute pickup window when placing an order, so they can plan their day around a guaranteed collection time. The kitchen receives advance notice and can pace preparation. Students who book a slot skip the walk-up queue.

---

## 2. User Stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-1 | Student | See available 15-minute pickup windows for today | I can pick a time that fits my schedule |
| US-2 | Student | See how many spots are left in each window | I know if a slot is filling up |
| US-3 | Student | Have my chosen slot confirmed on my order | I know exactly when to go |
| US-4 | Student | Be blocked from booking a full slot | I don't get disappointed at pickup |
| US-5 | Student | See my pickup time on my Orders page | I can check it without remembering |
| US-6 | Kitchen staff | Have a capacity limit per slot | Orders don't pile up faster than they can be made |

---

## 3. Scope

### In scope
- 15-minute slot generation for the current day
- Per-slot capacity enforcement (default: 10 orders)
- Slot picker UI on the menu/order flow
- Pickup time displayed on the Orders page
- API to list available slots with remaining capacity

### Out of scope (future)
- Multi-day advance ordering
- Admin UI for adjusting capacity or hours
- SMS/email notifications when food is ready
- Automatic stock decrement on order

---

## 4. Functional Requirements

### FR-1: Slot Generation
- Slots are generated dynamically in application logic — **not pre-populated** in the database.
- Operating hours: **10:00 to 14:00**, Monday to Saturday (canteen lunch window).
- Slot duration: **15 minutes** (yields 16 slots per day: 10:00, 10:15, 10:30 … 13:45).
- A slot is offered to users only if its `startTime` is at least **15 minutes in the future** (minimum lead time).
- Past slots and the current slot are not shown.

### FR-2: Slot Capacity
- Each slot has a maximum of **10 orders** (configurable via the `capacity` column).
- A slot shows as "Full" when `orderCount >= capacity`. Full slots are displayed but disabled (not removable from the list — transparency matters).
- Remaining capacity is shown: e.g., `8 left`, `2 left`, `Full`.

### FR-3: Concurrency & Double-Booking Prevention
- Slot booking is wrapped in a **Prisma `$transaction`**:
  1. Count current orders for the slot.
  2. If `count >= capacity`, throw a `SlotFullError`.
  3. Otherwise, create the order with the linked slot.
- This is atomic at the SQLite level and prevents two students claiming the last spot simultaneously.

### FR-4: Slot Persistence
- When a user books a slot, the slot is **upserted** into the `PickupSlot` table (created if it doesn't exist for that time window).
- This keeps the DB lean: only slots that have at least one booking are stored.

### FR-5: Order Flow Change
- The "Place order" button is **disabled** until a pickup slot is selected.
- The selected slot appears in the sticky cart bar alongside the total price.
- After a successful order, the confirmation message shows the pickup time: `"Order placed. Pick up at 12:15 – 12:30."`

### FR-6: Orders Page
- Each order card shows the pickup window if one was selected.
- Format: `Pickup: 12:15 – 12:30`

### FR-7: Public Slot API
- The slots endpoint is intentionally **public** (no auth required), using the same documented escape-hatch as `GET /api/menu`, since slot availability is not sensitive data.
- Requires the `// eslint-disable-next-line canteen/require-auth-wrapper` comment and a reviewer note.

---

## 5. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Slot capacity check must be **atomic** — no race conditions under concurrent load |
| NFR-2 | Slot list response must be < 200ms on the dev SQLite setup |
| NFR-3 | The feature must not break the existing order flow for users who don't select a slot (slot is **optional** — `pickupSlotId` is nullable) |
| NFR-4 | All new API routes must pass `npm run lint` (auth wrapper rule) |
| NFR-5 | All new service methods must have unit tests (`npm test`) |
| NFR-6 | No new npm dependencies — use only the existing Next.js / Prisma / TypeScript stack |

---

## 6. Database Schema Changes

### New model: `PickupSlot`

```prisma
model PickupSlot {
  id        String   @id @default(cuid())
  label     String   // Human-readable: "12:15 – 12:30"
  startTime DateTime
  endTime   DateTime
  capacity  Int      @default(10)
  orders    Order[]

  @@index([startTime])
}
```

### Modified model: `Order`

Add one optional foreign key:

```prisma
model Order {
  // --- existing fields, unchanged ---
  id           String      @id @default(cuid())
  userId       String
  status       String      @default("pending")
  totalCents   Int
  notes        String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  items        OrderItem[]

  // --- new field ---
  pickupSlotId String?
  pickupSlot   PickupSlot? @relation(fields: [pickupSlotId], references: [id])

  @@index([userId])
}
```

**Migration:** `npm run db:migrate` — generates a new migration file. The `pickupSlotId` column is nullable so all existing orders remain valid.

---

## 7. API Specification

### `GET /api/pickup-slots`

**Auth:** None (public)  
**Query params:** `date` (optional, ISO date string `YYYY-MM-DD`, defaults to today)

**Response 200:**
```json
[
  {
    "id": "clx...",
    "label": "10:00 – 10:15",
    "startTime": "2026-04-28T04:30:00.000Z",
    "endTime": "2026-04-28T04:45:00.000Z",
    "capacity": 10,
    "orderCount": 3,
    "remaining": 7,
    "isFull": false
  },
  {
    "id": null,
    "label": "10:15 – 10:30",
    "startTime": "2026-04-28T04:45:00.000Z",
    "endTime": "2026-04-28T05:00:00.000Z",
    "capacity": 10,
    "orderCount": 0,
    "remaining": 10,
    "isFull": false
  }
]
```

> Note: `id` is `null` if no order has been placed in that slot yet (slot not yet persisted). The frontend sends `startTime` when placing an order; the backend upserts the slot.

### `POST /api/orders` (modified)

**Auth:** Required (`withAuth`)  
**Body — new optional field:**

```json
{
  "items": [{ "menuItemId": "clx...", "quantity": 2 }],
  "notes": "less spicy",
  "pickupSlotStartTime": "2026-04-28T04:30:00.000Z"
}
```

**Error — slot full:**
```json
HTTP 409
{ "error": "This pickup slot is full. Please choose another time." }
```

**Success 201 — new field in response:**
```json
{
  "id": "clx...",
  "status": "pending",
  "totalCents": 400,
  "pickupSlot": {
    "label": "10:00 – 10:15",
    "startTime": "2026-04-28T04:30:00.000Z"
  }
}
```

---

## 8. Service Layer

### New: `src/lib/services/pickup-slot.ts`

```typescript
// Public interface

class PickupSlotService {
  /** All slots in operating hours for a given date, with live orderCount from DB */
  static async listWithAvailability(date: Date): Promise<SlotWithAvailability[]>

  /**
   * Upsert the slot record for a given startTime + endTime.
   * Called inside the order $transaction — returns the slot id.
   */
  static async upsertSlot(startTime: Date, endTime: Date, label: string): Promise<PickupSlot>

  /** Config — generates the raw time windows for a day */
  static generateWindows(date: Date): SlotWindow[]
}

type SlotWindow = { label: string; startTime: Date; endTime: Date }

type SlotWithAvailability = SlotWindow & {
  id: string | null     // null if never booked
  capacity: number
  orderCount: number
  remaining: number
  isFull: boolean
}
```

**Constants (defined at top of file, easy to adjust):**
```typescript
const SLOT_DURATION_MINUTES = 15;
const OPEN_HOUR = 10;   // 10:00
const CLOSE_HOUR = 14;  // 14:00 (last slot starts at 13:45)
const CAPACITY_DEFAULT = 10;
const MIN_LEAD_MINUTES = 15;
```

### Modified: `src/lib/services/order.ts`

`OrderService.create()` gains an optional `pickupSlotStartTime: Date | undefined`:

```typescript
// Inside create(), when pickupSlotStartTime is provided:
return await prisma.$transaction(async (tx) => {
  const slot = await PickupSlotService.upsertSlot(startTime, endTime, label);
  const count = await tx.order.count({ where: { pickupSlotId: slot.id } });

  if (count >= slot.capacity) {
    throw new SlotFullError("This pickup slot is full. Please choose another time.");
  }

  return tx.order.create({
    data: {
      userId,
      notes,
      totalCents,
      pickupSlotId: slot.id,
      items: { create: orderItems },
    },
    include: { items: { include: { menuItem: true } }, pickupSlot: true },
  });
});
```

A custom `SlotFullError` class (extends `Error`) lets the route handler return HTTP 409 specifically.

---

## 9. UI / Frontend Changes

### `src/app/menu/_components/menu-client.tsx`

#### State additions
```typescript
const [slots, setSlots] = useState<SlotWithAvailability[]>([]);
const [selectedSlot, setSelectedSlot] = useState<SlotWithAvailability | null>(null);
const [slotsLoading, setSlotsLoading] = useState(true);
```

#### Slot fetch on mount
```typescript
useEffect(() => {
  fetch('/api/pickup-slots')
    .then(r => r.json())
    .then(setSlots)
    .finally(() => setSlotsLoading(false));
}, []);
```

#### Slot picker — placed between the menu list and the sticky cart bar

The slot picker is a **horizontal scrollable row of pill buttons**, each showing:
- Time label: `10:00 – 10:15`
- Remaining count: `8 left` / `Full`
- Selected state: highlighted with `--brand` colour
- Disabled state: muted, cursor not-allowed (for full slots)

```
┌─────────────────────────────────────────────────────┐
│  📅 Choose your pickup time                          │
│                                                     │
│  [10:00–10:15  8 left]  [10:15–10:30  Full ✗]      │
│  [10:30–10:45  10 left] [10:45–11:00  2 left]  →   │
└─────────────────────────────────────────────────────┘
```

#### Sticky cart bar — updated
- Shows selected slot: `Pickup: 12:15 – 12:30`
- "Place order →" button disabled until a slot is selected AND cart has items

#### Success message — updated
```
Order placed. Pick up at 12:15 – 12:30. ✓
```
Link: "View orders →"

### `src/app/orders/page.tsx`

Each order card gains a pickup row (if `pickupSlot` is present):

```
┌────────────────────────────────┐
│ Order #A3F2B1    ● pending     │
│ Apr 28, 12:02 PM               │
│ 🕐 Pickup: 12:15 – 12:30       │ ← new
│ ─────────────────────────────  │
│ 1× Chicken Biryani    $3.50    │
│ Total               $3.50      │
└────────────────────────────────┘
```

---

## 10. File Map

```
prisma/
  schema.prisma                         ← ADD PickupSlot model, pickupSlotId on Order

src/
  app/
    api/
      pickup-slots/
        route.ts                        ← NEW  GET /api/pickup-slots
      orders/
        route.ts                        ← MODIFY  accept pickupSlotStartTime
        [id]/
          route.ts                      ← unchanged
    menu/
      _components/
        menu-client.tsx                 ← MODIFY  slot picker UI + fetch + cart update
    orders/
      page.tsx                          ← MODIFY  show pickupSlot on order card

  lib/
    services/
      pickup-slot.ts                    ← NEW  PickupSlotService
      order.ts                          ← MODIFY  $transaction + SlotFullError

tests/ (or src/lib/services/__tests__/)
  pickup-slot.test.ts                   ← NEW  unit tests for generateWindows + capacity logic
```

---

## 11. Error Handling

| Scenario | HTTP | Response |
|---|---|---|
| `pickupSlotStartTime` not in operating hours | 400 | `{ "error": "Invalid pickup time." }` |
| `pickupSlotStartTime` in the past or < 15 min away | 400 | `{ "error": "Pickup time is too soon. Choose a slot at least 15 minutes away." }` |
| Slot is at capacity (race condition caught by transaction) | 409 | `{ "error": "This pickup slot is full. Please choose another time." }` |
| Order placed without a slot (slot is optional) | 201 | Normal order response, `pickupSlot: null` |

---

## 12. Tests

### Unit tests — `src/lib/services/__tests__/pickup-slot.test.ts`

| Test | What it checks |
|---|---|
| `generateWindows` returns 16 slots for a weekday | Correct count and times |
| `generateWindows` filters out past slots | Slots before `now + 15min` excluded |
| `listWithAvailability` returns correct `remaining` | `capacity - orderCount` |
| `listWithAvailability` marks slot as `isFull` when count equals capacity | `isFull: true` |
| `OrderService.create` with a full slot throws `SlotFullError` | Transaction rolls back |
| `OrderService.create` without `pickupSlotStartTime` succeeds | Backward-compatible |

### Integration / browser tests

- Place order with slot selected → Orders page shows pickup time
- Attempt to book full slot via UI → error toast shown, order not placed
- Slot picker disables "Place order" until a slot is chosen

---

## 13. Rollout Notes

1. Run `npm run db:migrate` — adds `PickupSlot` table and nullable `pickupSlotId` to `Order`. Existing rows unaffected.
2. `pickupSlotId` is **nullable** — students who somehow bypass the UI or use the raw API still get a valid order (backward-compatible).
3. No changes to the seed users or menu items required.
4. Once deployed, the operating hours and capacity can be tuned by changing the constants in `pickup-slot.ts` without any schema changes.
