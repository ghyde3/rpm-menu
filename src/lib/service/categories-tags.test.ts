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
});
