import { describe, it, expect } from "vitest";
import { hasPermission, ROLE_PERMISSIONS } from "./rbac.js";

describe("RBAC", () => {
  it("owner should have all permissions", () => {
    expect(hasPermission("owner", [], "proxy")).toBe(true);
    expect(hasPermission("owner", [], "admin")).toBe(true);
    expect(hasPermission("owner", [], "manage:keys")).toBe(true);
  });

  it("viewer should only have read permissions", () => {
    expect(hasPermission("viewer", [], "read:logs")).toBe(true);
    expect(hasPermission("viewer", [], "read:audit")).toBe(true);
    expect(hasPermission("viewer", [], "proxy")).toBe(false);
    expect(hasPermission("viewer", [], "write:budgets")).toBe(false);
  });

  it("editor should have proxy + read + write (not manage:keys)", () => {
    expect(hasPermission("editor", [], "proxy")).toBe(true);
    expect(hasPermission("editor", [], "write:budgets")).toBe(true);
    expect(hasPermission("editor", [], "manage:keys")).toBe(false);
  });

  it("admin key permission should override role", () => {
    expect(hasPermission("viewer", ["admin"], "manage:keys")).toBe(true);
  });

  it("specific key permission should grant access", () => {
    expect(hasPermission("viewer", ["proxy"], "proxy")).toBe(true);
  });

  it("unknown role should have no permissions", () => {
    expect(hasPermission("unknown", [], "read:logs")).toBe(false);
  });
});
