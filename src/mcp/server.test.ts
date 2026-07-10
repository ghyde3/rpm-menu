// End-to-end wiring test: a real `Client` <-> `McpServer` pair talking over
// linked in-memory transports (no stdio, no child process), exercising the
// full path an actual AI client would take -- `tools/list`, Zod input
// validation, scope enforcement, and error surfacing as `isError` results.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { categories, items } from "@/db/schema";
import { createMcpServer } from "./server";
import type { McpToolContext } from "./tool-helpers";

async function seedCategory(db: Database, name = "Drinks") {
  const [category] = await db.insert(categories).values({ name, type: "drink" }).returning();
  return category;
}

async function seedItem(db: Database, categoryId: string, overrides: Partial<typeof items.$inferInsert> = {}) {
  const [item] = await db
    .insert(items)
    .values({ name: "Coors Light", categoryId, priceCents: 500, pricingType: "fixed", isAvailable: true, ...overrides })
    .returning();
  return item;
}

describe("mcp server end-to-end (in-memory transport)", () => {
  let db: Database;
  let client: Client;

  beforeAll(async () => {
    db = await createTestDb();
    const ctx: McpToolContext = {
      db,
      caller: { actor: { type: "system", id: "00000000-0000-0000-0000-0000000000ee" }, surface: "mcp" },
      scopes: ["read", "write:availability"],
      apiKeyId: "00000000-0000-0000-0000-0000000000ee",
    };
    const server = createMcpServer(ctx);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "0.0.0" });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  });

  afterAll(async () => {
    await client.close();
  });

  it("lists all 9 spec'd tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "apply_pending_change",
        "get_recent_changes",
        "get_screen",
        "list_86d",
        "preview_price_adjustment",
        "search_items",
        "set_availability",
        "update_item",
        "update_screen",
      ].sort(),
    );
  });

  it("calls search_items and gets back structured JSON text content", async () => {
    const category = await seedCategory(db, "E2E Category");
    await seedItem(db, category.id, { name: "We're Out of Coors" });

    const result = await client.callTool({ name: "search_items", arguments: { q: "Coors" } });
    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.items.some((i: { name: string }) => i.name === "We're Out of Coors")).toBe(true);
  });

  it("86's an item live in one call (the headline demo)", async () => {
    const category = await seedCategory(db, "Headline Category");
    const item = await seedItem(db, category.id, { name: "Coors Banquet", isAvailable: true });

    const result = await client.callTool({
      name: "set_availability",
      arguments: { itemId: item.id, isAvailable: false },
    });
    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.item.isAvailable).toBe(false);
  });

  it("returns isError for a tool call missing the required scope", async () => {
    const category = await seedCategory(db, "Scope Category");
    const item = await seedItem(db, category.id);

    // This client's key only has read + write:availability -- update_item
    // needs write:items, which it doesn't have.
    const result = await client.callTool({
      name: "update_item",
      arguments: { itemId: item.id, name: "New Name" },
    });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("write:items");
  });

  it("returns isError (Zod validation) for a malformed itemId", async () => {
    const result = await client.callTool({
      name: "set_availability",
      arguments: { itemId: "not-a-uuid", isAvailable: true },
    });
    expect(result.isError).toBe(true);
  });
});
