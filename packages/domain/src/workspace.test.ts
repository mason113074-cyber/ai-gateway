import { describe, expect, it } from "vitest";
import {
  getEffectiveRole,
  type Workspace,
  type WorkspaceMember,
} from "./workspace";

describe("getEffectiveRole", () => {
  const workspace: Workspace = { id: "ws-1", name: "Acme" };
  const members: WorkspaceMember[] = [
    { workspaceId: "ws-1", userId: "user-a", role: "admin" },
    { workspaceId: "ws-1", userId: "user-b", role: "viewer" },
    { workspaceId: "ws-2", userId: "user-a", role: "viewer" },
  ];

  it("returns admin when user has admin role in workspace", () => {
    expect(getEffectiveRole(workspace, "user-a", members)).toBe("admin");
  });

  it("returns viewer when user has viewer role in workspace", () => {
    expect(getEffectiveRole(workspace, "user-b", members)).toBe("viewer");
  });

  it("returns null when user is not in workspace", () => {
    expect(getEffectiveRole(workspace, "user-unknown", members)).toBe(null);
  });

  it("returns null when members list is empty", () => {
    expect(getEffectiveRole(workspace, "user-a", [])).toBe(null);
  });
});
