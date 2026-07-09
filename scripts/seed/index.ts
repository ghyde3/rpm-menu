// Minimal foundation seed: the venue_settings singleton row + the first
// owner account, so `npm run db:seed` leaves a working, loggable-into
// instance. Importing the real menu (rpm-menu-extracted.md,
// rpm-drinks-extracted.md) is the onboarding-seed-and-runbook unit's job
// (M3) — this script intentionally does not touch items/categories/tags.
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts, venueSettings, VENUE_SETTINGS_ID } from "@/db/schema";

async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;

  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      "SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD must be set (see .env.example) before running db:seed.",
    );
  }
  if (ownerPassword.length < 8) {
    throw new Error("SEED_OWNER_PASSWORD must be at least 8 characters.");
  }

  const existingSettings = await db
    .select({ id: venueSettings.id })
    .from(venueSettings)
    .where(eq(venueSettings.id, VENUE_SETTINGS_ID));
  if (existingSettings.length === 0) {
    await db.insert(venueSettings).values({ id: VENUE_SETTINGS_ID });
    console.log("Created venue_settings singleton row.");
  } else {
    console.log("venue_settings row already exists, skipping.");
  }

  const existingOwner = await db.select({ id: users.id }).from(users).where(eq(users.email, ownerEmail));
  if (existingOwner.length > 0) {
    console.log(`Owner ${ownerEmail} already exists, skipping.`);
  } else {
    const [owner] = await db
      .insert(users)
      .values({
        email: ownerEmail,
        name: "Owner",
        role: "owner",
        emailVerified: true,
      })
      .returning({ id: users.id });

    const passwordHash = await hashPassword(ownerPassword);
    await db.insert(accounts).values({
      userId: owner.id,
      accountId: owner.id,
      providerId: "credential",
      password: passwordHash,
    });
    console.log(`Created owner account: ${ownerEmail}`);
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
