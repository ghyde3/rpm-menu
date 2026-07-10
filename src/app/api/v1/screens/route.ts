// GET /api/v1/screens — list screens (§3.7 "read/update screens"). Scope:
// read.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { authenticateApiRequest } from "@/lib/api/auth-middleware";
import { listScreens } from "@/lib/service/screens";
import { apiErrorResponse } from "../_lib/http";

export async function GET(req: NextRequest) {
  try {
    await authenticateApiRequest(db, req, { scope: "read" });
    const screens = await listScreens(db);
    return NextResponse.json({ screens });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
