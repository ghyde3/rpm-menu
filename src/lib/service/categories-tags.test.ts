import { describe, expect, it, beforeAll } from "vitest";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { createCategory, updateCategory, deleteCategory } from "./categories";
import { createTag, updateTag, deleteTag } from "./tags";
import { createItem, setItemTags } from "./items";
import type { ServiceCaller } from "./base";

const owner: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000dd" },
  surface: "admin_ui",
  role: "owner",
  isActive: true,
};

describe("categories + tags services", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("creates, updates, and deletes an empty category", async () => {
    const category = await createCategory(db, owner, { name: "Sides", type: "food" });
    expect(category.tagline).toBeNull();

    const updated = await updateCategory(db, owner, category.id, { tagline: "★ Made to Share!" });
    expect(updated.tagline).toBe("★ Made to Share!");

    await deleteCategory(db, owner, category.id);
  });

  it("refuses to delete a category that still has items", async () => {
    const category = await createCategory(db, owner, { name: "Entrees", type: "food" });
    await createItem(db, owner, { name: "Steak", categoryId: category.id });
    await expect(deleteCategory(db, owner, category.id)).rejects.toThrow();
  });

  it("creates a public tag with an icon/color and attaches it to an item", async () => {
    const category = await createCategory(db, owner, { name: "Drinks", type: "drink" });
    const item = await createItem(db, owner, { name: "IPA", categoryId: category.id });
    const tag = await createTag(db, owner, { name: "gluten-free", visibility: "public", icon: "gf" });

    const tagIds = await setItemTags(db, owner, item.id, { tagIds: [tag.id] });
    expect(tagIds).toEqual([tag.id]);

    const updatedTag = await updateTag(db, owner, tag.id, { color: "#00ff00" });
    expect(updatedTag.color).toBe("#00ff00");

    await deleteTag(db, owner, tag.id);
  });

  // Regression test for the Zod v4 `.partial()` + `.default(...)` silent-
  // reset bug (screens.ts's `updateScreenSchema` block comment): a partial
  // `updateTag` call must never reset `visibility` back to its create-time
  // default ("private") just because the caller didn't mention it.
  it("preserves non-default visibility on a partial updateTag call", async () => {
    const tag = await createTag(db, owner, { name: "staff-pick", visibility: "public" });
    expect(tag.visibility).toBe("public");

    const updated = await updateTag(db, owner, tag.id, { color: "#123456" });
    expect(updated.color).toBe("#123456");
    expect(updated.visibility).toBe("public");
  });

  it("refuses staff from creating, editing, or deleting a tag (visibility is owner-managed)", async () => {
    const staff: ServiceCaller = {
      actor: { type: "user", id: "00000000-0000-0000-0000-0000000000ee" },
      surface: "admin_ui",
      role: "staff",
      isActive: true,
    };
    await expect(createTag(db, staff, { name: "new", visibility: "public" })).rejects.toThrow();

    const tag = await createTag(db, owner, { name: "special", visibility: "private" });
    await expect(updateTag(db, staff, tag.id, { visibility: "public" })).rejects.toThrow();
    await expect(deleteTag(db, staff, tag.id)).rejects.toThrow();
  });
});
