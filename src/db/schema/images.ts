// PRD §5.1: `images id, key, variants jsonb, created_at -- R2/Blob refs`
// Owned/written by the image-pipeline unit (src/lib/service/images.ts);
// referenced by items, categories, venue_settings.
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Shape written into `images.variants`: one URL per processed size. */
export interface ImageVariants {
  thumb?: string;
  card?: string;
  display?: string;
  [key: string]: string | undefined;
}

export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  variants: jsonb("variants").$type<ImageVariants>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
