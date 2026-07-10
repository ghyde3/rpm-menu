// GET /api/v1/items — search/list items (§3.7). Scope: read.
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { itemTags } from "@/db/schema";
import { authenticateApiRequest } from "@/lib/api/auth-middleware";
import { listItems } from "@/lib/service/items";
import { apiErrorResponse } from "../_lib/http";
import { parseItemsQuery, filterAndPageItems } from "../_lib/items-query";

export async function GET(req: NextRequest) {
  try {
    await authenticateApiRequest(db, req, { scope: "read" });

    const query = parseItemsQuery(req.nextUrl.searchParams);

    let itemIdsWithTag: Set<string> | undefined;
    if (query.tagId) {
      const rows = await db
        .select({ itemId: itemTags.itemId })
        .from(itemTags)
        .where(eq(itemTags.tagId, query.tagId));
      itemIdsWithTag = new Set(rows.map((r) => r.itemId));
    }

    const allItems = await listItems(db);
    const { items, total } = filterAndPageItems(allItems, { ...query, itemIdsWithTag });

    return NextResponse.json({ items, total, limit: query.limit, offset: query.offset });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
