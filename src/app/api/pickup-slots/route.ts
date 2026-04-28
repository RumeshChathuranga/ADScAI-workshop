import { NextRequest, NextResponse } from "next/server";
import { PickupSlotService } from "@/lib/services/pickup-slot";

// Public endpoint — slot availability is not sensitive data. This is the
// documented escape hatch from the canteen-route-protection skill and
// requires reviewer sign-off in CLAUDE.md.
// eslint-disable-next-line canteen/require-auth-wrapper
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateParam = searchParams.get("date");

  let date: Date;
  if (dateParam) {
    date = new Date(dateParam);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date parameter." }, { status: 400 });
    }
  } else {
    date = new Date();
  }

  const slots = await PickupSlotService.listWithAvailability(date);
  return NextResponse.json(slots);
}
