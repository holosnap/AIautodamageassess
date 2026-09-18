import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

/**
 * Resolves the signed-in user's local `User` row, upserting it from the
 * Clerk profile on first access. This is the fallback path for keeping
 * `users` in sync; the Clerk webhook (api/webhooks/clerk) keeps it current
 * on profile changes without requiring the user to hit the app again.
 */
export async function getOrCreateUser(): Promise<User> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const existing = await db.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error("Not authenticated");
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error("Signed-in user has no email address on file");
  }

  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  return db.user.upsert({
    where: { clerkId: userId },
    update: { email, name },
    create: { clerkId: userId, email, name },
  });
}

/** Throws if there is no signed-in user; otherwise returns their Clerk user id. */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}
