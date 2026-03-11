/**
 * Workspace (tenant) and role types for T001 scaffold.
 * Not used for production authorization — placeholder for RBAC shape.
 */

export type WorkspaceRole = "admin" | "viewer";

export interface Workspace {
  id: string;
  name: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

/**
 * Resolves the effective role for a user in a workspace.
 * Scaffold: no persistence; used for tests and future RBAC.
 */
export function getEffectiveRole(
  _workspace: Workspace,
  _userId: string,
  members: WorkspaceMember[],
): WorkspaceRole | null {
  const member = members.find(
    (m) => m.workspaceId === _workspace.id && m.userId === _userId,
  );
  return member?.role ?? null;
}
