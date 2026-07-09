// Mounts every Better Auth endpoint (sign-in, sign-out, session, etc.) under
// /api/auth/**. See src/lib/auth/config.ts for the auth instance.
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/config";

export const { GET, POST } = toNextJsHandler(auth);
