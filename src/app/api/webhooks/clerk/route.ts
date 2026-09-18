import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const { id, email_addresses, primary_email_address_id, first_name, last_name } = event.data;
      const primaryEmail =
        email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ??
        email_addresses[0]?.email_address;

      if (!primaryEmail) break;

      const name = [first_name, last_name].filter(Boolean).join(" ") || null;

      await db.user.upsert({
        where: { clerkId: id },
        update: { email: primaryEmail, name },
        create: { clerkId: id, email: primaryEmail, name },
      });
      break;
    }
    case "user.deleted": {
      if (event.data.id) {
        await db.user.deleteMany({ where: { clerkId: event.data.id } });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
