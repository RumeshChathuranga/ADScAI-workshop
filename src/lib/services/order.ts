import { prisma } from "@/lib/prisma";
import { PickupSlotService, SlotFullError, CAPACITY_DEFAULT } from "./pickup-slot";

export { SlotFullError };

export class OrderService {
  static async listForUser(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      include: {
        items: { include: { menuItem: true } },
        pickupSlot: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async create(args: {
    userId: string;
    items: Array<{ menuItemId: string; quantity: number }>;
    notes?: string;
    pickupSlotStartTime?: Date;
  }) {
    const { userId, items, notes, pickupSlotStartTime } = args;

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: items.map((i) => i.menuItemId) }, available: true },
    });

    const menuItemsById = new Map(menuItems.map((menuItem) => [menuItem.id, menuItem]));

    const hasInvalidQuantity = items.some(
      (item) => !Number.isInteger(item.quantity) || item.quantity <= 0,
    );
    const hasUnavailableMenuItem = items.some((item) => !menuItemsById.has(item.menuItemId));

    if (hasInvalidQuantity || hasUnavailableMenuItem) {
      const error = new Error("Invalid order items");
      (error as Error & { status: number }).status = 400;
      throw error;
    }

    const orderItems = items.map((item) => {
      const m = menuItemsById.get(item.menuItemId)!;
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPriceCents: m.priceCents,
      };
    });

    const totalCents = items.reduce((sum, item) => {
      const m = menuItemsById.get(item.menuItemId)!;
      return sum + m.priceCents * item.quantity;
    }, 0);

    if (!pickupSlotStartTime) {
      // Backward-compatible path: no slot selected
      return prisma.order.create({
        data: {
          userId,
          notes,
          totalCents,
          items: { create: orderItems },
        },
        include: {
          items: { include: { menuItem: true } },
          pickupSlot: true,
        },
      });
    }

    // Slot path: atomic transaction to prevent double-booking
    return prisma.$transaction(async (tx) => {
      // Derive endTime and label from startTime
      const endTime = new Date(pickupSlotStartTime.getTime() + 15 * 60_000);
      const fmt = (d: Date) =>
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const label = `${fmt(pickupSlotStartTime)} \u2013 ${fmt(endTime)}`;

      // Upsert the slot (may already exist from a previous booking)
      const slot = await PickupSlotService.upsertSlot(pickupSlotStartTime, endTime, label, tx);

      // Atomic capacity check
      const count = await tx.order.count({ where: { pickupSlotId: slot.id } });
      if (count >= (slot.capacity ?? CAPACITY_DEFAULT)) {
        throw new SlotFullError();
      }

      return tx.order.create({
        data: {
          userId,
          notes,
          totalCents,
          pickupSlotId: slot.id,
          items: { create: orderItems },
        },
        include: {
          items: { include: { menuItem: true } },
          pickupSlot: true,
        },
      });
    });
  }

  static async byId(id: string, userId: string) {
    return prisma.order.findFirst({
      where: { id, userId },
      include: {
        items: { include: { menuItem: true } },
        pickupSlot: true,
      },
    });
  }

  static async updateStatus(id: string, userId: string, status: string) {
    const allowed = new Set(["pending", "ready", "picked_up"]);
    if (!allowed.has(status)) {
      throw new Error(`invalid status: ${status}`);
    }
    const order = await prisma.order.findFirst({ where: { id, userId } });
    if (!order) return null;
    return prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { menuItem: true } },
        pickupSlot: true,
      },
    });
  }

  static async remove(id: string, userId: string) {
    const order = await prisma.order.findFirst({ where: { id, userId } });
    if (!order) return null;
    return prisma.order.delete({ where: { id } });
  }
}
