import { describe, expect, it } from "vitest";
import { AuthError, requireOwner, requireRole, requireStaffOrOwner } from "./role-guard";

describe("role-guard", () => {
  it("throws 401 for a missing actor", () => {
    expect(() => requireRole(null, ["owner"])).toThrowError(AuthError);
    try {
      requireRole(undefined, ["owner"]);
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).status).toBe(401);
    }
  });

  it("throws 401 for a deactivated actor", () => {
    try {
      requireRole({ role: "owner", isActive: false }, ["owner"]);
    } catch (err) {
      expect((err as AuthError).status).toBe(401);
    }
  });

  it("throws 403 when role isn't allowed", () => {
    try {
      requireOwner({ role: "staff", isActive: true });
      throw new Error("should not reach");
    } catch (err) {
      expect((err as AuthError).status).toBe(403);
    }
  });

  it("allows staff or owner for requireStaffOrOwner", () => {
    expect(requireStaffOrOwner({ role: "staff", isActive: true }).role).toBe("staff");
    expect(requireStaffOrOwner({ role: "owner", isActive: true }).role).toBe("owner");
  });
});
