import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/wrappers";
import { OrderService, SlotFullError } from "@/lib/services/order";
import { OPEN_HOUR, CLOSE_HOUR } from "@/lib/services/pickup-slot";

const MIN_LEAD_MINUTES = 15;

export const GET = withAuth(async (_req, ctx) => {
  const orders = await OrderService.listForUser(ctx.userId);
  return NextResponse.json(orders);
});

export const POST = withAuth(async (req, ctx) => {
  const body = await req.json();

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items required" }, { status: 400 });
  }

  let pickupSlotStartTime: Date | undefined;

  if (body.pickupSlotStartTime) {
    pickupSlotStartTime = new Date(body.pickupSlotStartTime);

    if (isNaN(pickupSlotStartTime.getTime())) {
      return NextResponse.json({ error: "Invalid pickup time." }, { status: 400 });
    }

    // Validate lead time
    const minutesUntil = (pickupSlotStartTime.getTime() - Date.now()) / 60_000;
    if (minutesUntil < MIN_LEAD_MINUTES) {
      return NextResponse.json(
        { error: "Pickup time is too soon. Choose a slot at least 15 minutes away." },
        { status: 400 },
      );
    }

    // Validate operating hours
    const h = pickupSlotStartTime.getHours();
    const m = pickupSlotStartTime.getMinutes();
    const totalMinutes = h * 60 + m;
    if (totalMinutes < OPEN_HOUR * 60 || totalMinutes >= CLOSE_HOUR * 60) {
      return NextResponse.json({ error: "Invalid pickup time." }, { status: 400 });
    }
  }

  try {
    const order = await OrderService.create({
      userId: ctx.userId,
      items: body.items,
      notes: body.notes,
      pickupSlotStartTime,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    if (err instanceof SlotFullError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
});
