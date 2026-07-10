import { describe, expect, it, beforeAll } from "vitest";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { screens } from "@/db/schema";
import { getScreen, updateScreen } from "./screens";
import { McpScopeError } from "../tool-helpers";
import type { McpToolContext } from "../tool-helpers";

const API_KEY_ID = "00000000-0000-0000-0000-0000000000cc";

function ctxWithScopes(db: Database, scopes: string[]): McpToolContext {
  return {
    db,
    caller: { actor: { type: "system", id: API_KEY_ID }, surface: "mcp" },
    scopes: scopes as McpToolContext["scopes"],
    apiKeyId: API_KEY_ID,
  };
}

async function seedScreen(db: Database, overrides: Partial<typeof screens.$inferInsert> = {}) {
  const [screen] = await db.insert(screens).values({ name: "Main TV", ...overrides }).returning();
  return screen;
}

describe("mcp tools/screens", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  describe("getScreen", () => {
    it("requires the read scope", async () => {
      const screen = await seedScreen(db);
      await expect(getScreen(ctxWithScopes(db, []), { screenId: screen.id })).rejects.toBeInstanceOf(McpScopeError);
    });

    it("reads a screen's full configuration", async () => {
      const screen = await seedScreen(db, { name: "Patio Screen", template: "grid" });
      const result = await getScreen(ctxWithScopes(db, ["read"]), { screenId: screen.id });
      expect(result.screen.id).toBe(screen.id);
      expect(result.screen.name).toBe("Patio Screen");
      expect(result.screen.template).toBe("grid");
    });
  });

  describe("updateScreen", () => {
    it("requires the write:screens scope", async () => {
      const screen = await seedScreen(db);
      await expect(
        updateScreen(ctxWithScopes(db, ["read"]), { screenId: screen.id, name: "Renamed" }),
      ).rejects.toBeInstanceOf(McpScopeError);
    });

    it("updates a screen's fields", async () => {
      const screen = await seedScreen(db, { name: "Old Name" });
      const result = await updateScreen(ctxWithScopes(db, ["write:screens"]), {
        screenId: screen.id,
        name: "New Name",
        displayOptions: { accentColor: "#ff0000" },
      });
      expect(result.screen.name).toBe("New Name");
      expect(result.screen.displayOptions).toMatchObject({ accentColor: "#ff0000" });
    });
  });
});
