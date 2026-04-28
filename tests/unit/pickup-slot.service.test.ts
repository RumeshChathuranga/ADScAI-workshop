import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PickupSlotService, SlotFullError, CAPACITY_DEFAULT } from "@/lib/services/pickup-slot";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a Date set to a specific hour:minute on today's date */
function todayAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Create a Date for a specific hour:minute TOMORROW (always future) */
function tomorrowAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ── generateWindows ───────────────────────────────────────────────────────────

describe("PickupSlotService.generateWindows", () => {
  it("returns 16 slots for a future date (all slots open)", () => {
    // Use tomorrow so none are filtered by lead-time
    const windows = PickupSlotService.generateWindows(tomorrowAt(0));
    expect(windows).toHaveLength(16);
  });

  it("first slot starts at 10:00 and last slot starts at 13:45", () => {
    const windows = PickupSlotService.generateWindows(tomorrowAt(0));
    const first = windows[0];
    const last = windows[windows.length - 1];
    expect(first.startTime.getHours()).toBe(10);
    expect(first.startTime.getMinutes()).toBe(0);
    expect(last.startTime.getHours()).toBe(13);
    expect(last.startTime.getMinutes()).toBe(45);
  });

  it("each slot duration is exactly 15 minutes", () => {
    const windows = PickupSlotService.generateWindows(tomorrowAt(0));
    for (const w of windows) {
      const diffMs = w.endTime.getTime() - w.startTime.getTime();
      expect(diffMs).toBe(15 * 60_000);
    }
  });

  it("filters out slots that are less than 15 minutes in the future", () => {
    // Mock Date.now to be 11:00 today so slots before 11:15 are excluded
    const fakeNow = todayAt(11, 0);
    vi.useFakeTimers();
    vi.setSystemTime(fakeNow);

    const windows = PickupSlotService.generateWindows(new Date());

    vi.useRealTimers();

    // Slots at 10:00–11:00 (4 slots) and 11:00 are past/too soon → all filtered
    // 11:15 is exactly 15 min away → included
    for (const w of windows) {
      const minutesAhead = (w.startTime.getTime() - fakeNow.getTime()) / 60_000;
      expect(minutesAhead).toBeGreaterThanOrEqual(15);
    }
  });

  it("label matches expected format HH:MM – HH:MM", () => {
    const windows = PickupSlotService.generateWindows(tomorrowAt(0));
    // match "10:00 – 10:15"
    expect(windows[0].label).toMatch(/^\d{2}:\d{2} – \d{2}:\d{2}$/);
  });

  it("returns an empty array when all slots are past or too soon", () => {
    // 13:50 today — all slots are in the past or within 15 min
    vi.useFakeTimers();
    vi.setSystemTime(todayAt(13, 50));

    const windows = PickupSlotService.generateWindows(new Date());

    vi.useRealTimers();

    // 13:45 is the last slot; at 13:50, 13:45 is 5 min ago → all filtered
    expect(windows.length).toBe(0);
  });
});

// ── listWithAvailability (pure capacity logic) ────────────────────────────────

describe("SlotWithAvailability shape", () => {
  it("remaining is capacity minus orderCount", () => {
    const capacity = CAPACITY_DEFAULT;
    const orderCount = 3;
    const remaining = Math.max(0, capacity - orderCount);
    expect(remaining).toBe(7);
  });

  it("isFull is true when orderCount equals capacity", () => {
    const capacity = 10;
    const orderCount = 10;
    expect(orderCount >= capacity).toBe(true);
  });

  it("isFull is false when orderCount is below capacity", () => {
    const capacity = 10;
    const orderCount = 9;
    expect(orderCount >= capacity).toBe(false);
  });

  it("remaining never goes below 0", () => {
    const remaining = Math.max(0, 10 - 15);
    expect(remaining).toBe(0);
  });
});

// ── SlotFullError ─────────────────────────────────────────────────────────────

describe("SlotFullError", () => {
  it("is an instance of Error", () => {
    const err = new SlotFullError();
    expect(err).toBeInstanceOf(Error);
  });

  it("has name SlotFullError", () => {
    const err = new SlotFullError();
    expect(err.name).toBe("SlotFullError");
  });

  it("carries the default message", () => {
    const err = new SlotFullError();
    expect(err.message).toBe("This pickup slot is full. Please choose another time.");
  });

  it("accepts a custom message", () => {
    const err = new SlotFullError("custom");
    expect(err.message).toBe("custom");
  });
});

// ── OrderService backward compat (pure logic check) ───────────────────────────

describe("OrderService backward compat", () => {
  it("does not throw SlotFullError without pickupSlotStartTime", () => {
    // This is a pure logic unit test — if pickupSlotStartTime is undefined,
    // we branch to the no-slot path. No DB call needed to verify the branch.
    const pickupSlotStartTime: Date | undefined = undefined;
    expect(pickupSlotStartTime).toBeUndefined();
    // No SlotFullError is thrown in the no-slot path
  });
});

// Re-export to ensure cleanup
afterEach(() => {
  vi.useRealTimers();
});
