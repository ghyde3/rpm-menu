// Full seed: the venue_settings singleton row + the first owner account,
// then the real menu (rpm-menu-extracted.md, rpm-drinks-extracted.md)
// parsed at runtime and loaded through the service layer (items/categories/
// tags/modifiers) — see import-menu.ts for the menu-import logic and its
// hard assertions.
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts, venueSettings, VENUE_SETTINGS_ID } from "@/db/schema";
import { importMenu } from "./import-menu";
import { importPhotos } from "./import-photos";

const ENV_PATH = path.resolve(process.cwd(), ".env");
// Anything matching this is a dev placeholder, not a real secret — treat it
// like "unset" and generate + persist a real one instead.
const PLACEHOLDER_PASSWORD_RE = /^change-me/i;

function generatePassword(): string {
  return randomBytes(24).toString("base64url"); // 32 chars, well over the 8-char minimum
}

/** Writes/updates `SEED_OWNER_PASSWORD=...` in `.env` (gitignored — never
 * committed) so a generated password survives across `db:seed` re-runs
 * instead of silently rotating every time. */
function persistOwnerPasswordToEnv(password: string): void {
  if (!existsSync(ENV_PATH)) {
    writeFileSync(ENV_PATH, `SEED_OWNER_PASSWORD=${password}\n`);
    return;
  }
  const raw = readFileSync(ENV_PATH, "utf-8");
  const line = `SEED_OWNER_PASSWORD=${password}`;
  const updated = /^SEED_OWNER_PASSWORD=.*$/m.test(raw)
    ? raw.replace(/^SEED_OWNER_PASSWORD=.*$/m, line)
    : `${raw.replace(/\n$/, "")}\n${line}\n`;
  writeFileSync(ENV_PATH, updated);
}

async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL;

  if (!ownerEmail) {
    throw new Error("SEED_OWNER_EMAIL must be set (see .env.example) before running db:seed.");
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
    // Password is only generated/rotated here, at actual account-creation
    // time — never on a re-run against a DB that already has this owner
    // (which would desync .env from the already-hashed password in
    // `accounts`). §3.8: "generated password written to .env only — never
    // committed" (.env is gitignored).
    let ownerPassword = process.env.SEED_OWNER_PASSWORD;
    if (!ownerPassword || PLACEHOLDER_PASSWORD_RE.test(ownerPassword)) {
      ownerPassword = generatePassword();
      persistOwnerPasswordToEnv(ownerPassword);
      console.log(`Generated SEED_OWNER_PASSWORD and wrote it to ${ENV_PATH} (not committed — see .gitignore).`);
    }
    if (ownerPassword.length < 8) {
      throw new Error("SEED_OWNER_PASSWORD must be at least 8 characters.");
    }

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

  await importMenu(db);
  await importPhotos(db);

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
