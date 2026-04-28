import { prisma } from "@/lib/prisma";
import type { PickupSlot } from "@prisma/client";

// ─── Configuration constants ─────────────────────────────────────────────────
const SLOT_DURATION_MINUTES = 15;
export const OPEN_HOUR = 10; // 10:00 local time
export const CLOSE_HOUR = 23; // Extended from 14 to 23 for testing
export const CAPACITY_DEFAULT = 10;
const MIN_LEAD_MINUTES = 15;

// ─── Types ───────────────────────────────────────────────────────────────────

export type SlotWindow = {
  label: string;
  startTime: Date;
  endTime: Date;
};

export type SlotWithAvailability = SlotWindow & {
  id: string | null; // null if the slot has never been booked (not yet in DB)
  capacity: number;
  orderCount: number;
  remaining: number;
  isFull: boolean;
};

// ─── Custom error ─────────────────────────────────────────────────────────────

export class SlotFullError extends Error {
  constructor(message = "This pickup slot is full. Please choose another time.") {
    super(message);
    this.name = "SlotFullError";
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PickupSlotService {
  /**
   * Generates every 15-minute window for the given date between OPEN_HOUR and
   * CLOSE_HOUR. Pure function — no DB access. Windows whose startTime is less
   * than MIN_LEAD_MINUTES from now are excluded.
   */
  static generateWindows(date: Date): SlotWindow[] {
    const windows: SlotWindow[] = [];
    const now = new Date();

    // Build windows in local time
    const base = new Date(date);
    base.setHours(0, 0, 0, 0);

    const totalSlots = ((CLOSE_HOUR - OPEN_HOUR) * 60) / SLOT_DURATION_MINUTES;

    for (let i = 0; i < totalSlots; i++) {
      const startMinutes = OPEN_HOUR * 60 + i * SLOT_DURATION_MINUTES;
      const endMinutes = startMinutes + SLOT_DURATION_MINUTES;

      const startTime = new Date(base);
      startTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

      const endTime = new Date(base);
      endTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

      // Filter out slots that are too soon
      const minutesUntilStart = (startTime.getTime() - now.getTime()) / 60_000;
      if (minutesUntilStart < MIN_LEAD_MINUTES) continue;

      const startHH = String(Math.floor(startMinutes / 60)).padStart(2, "0");
      const startMM = String(startMinutes % 60).padStart(2, "0");
      const endHH = String(Math.floor(endMinutes / 60)).padStart(2, "0");
      const endMM = String(endMinutes % 60).padStart(2, "0");
      const label = `${startHH}:${startMM} \u2013 ${endHH}:${endMM}`;

      windows.push({ label, startTime, endTime });
    }

    return windows;
  }

  /**
   * Returns all generated windows for the given date enriched with live
   * orderCount data from the DB.
   */
  static async listWithAvailability(date: Date): Promise<SlotWithAvailability[]> {
    const windows = PickupSlotService.generateWindows(date);
    if (windows.length === 0) return [];

    const startTimes = windows.map((w) => w.startTime);

    const persisted = await prisma.pickupSlot.findMany({
      where: { startTime: { in: startTimes } },
      include: { _count: { select: { orders: true } } },
    });

    const persistedMap = new Map(persisted.map((s) => [s.startTime.toISOString(), s]));

    return windows.map((w) => {
      const slot = persistedMap.get(w.startTime.toISOString());
      const capacity = slot?.capacity ?? CAPACITY_DEFAULT;
      const orderCount = slot?._count.orders ?? 0;
      return {
        ...w,
        id: slot?.id ?? null,
        capacity,
        orderCount,
        remaining: Math.max(0, capacity - orderCount),
        isFull: orderCount >= capacity,
      };
    });
  }

  /**
   * Upserts a slot row for the given time window. Uses the startTime @unique
   * constraint. Should be called inside the order $transaction.
   */
  static async upsertSlot(
    startTime: Date,
    endTime: Date,
    label: string,
    tx: any = prisma
  ): Promise<PickupSlot> {
    return tx.pickupSlot.upsert({
      where: { startTime },
      update: {},
      create: { label, startTime, endTime },
    });
  }
}
