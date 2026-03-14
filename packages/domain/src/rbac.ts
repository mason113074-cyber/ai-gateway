export const PERMISSIONS = {
  proxy: "Can make proxy requests to LLM providers",
  "read:logs": "Can view proxy logs",
  "read:audit": "Can view audit logs",
  "read:costs": "Can view cost data",
  "write:agents": "Can create/update agents",
  "write:budgets": "Can set/modify budgets",
  "write:policies": "Can modify policy rules",
  "manage:keys": "Can create/revoke API keys",
  admin: "Full access (includes all permissions)",
} as const;

export type Permission = keyof typeof PERMISSIONS;

const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  editor: [
    "proxy",
    "read:logs",
    "read:audit",
    "read:costs",
    "write:agents",
    "write:budgets",
  ],
  viewer: ["read:logs", "read:audit", "read:costs"],
};

export type Role = keyof typeof ROLE_PERMISSIONS;

export function hasPermission(
  userRole: string,
  keyPermissions: string[],
  required: string
): boolean {
  if (keyPermissions.includes("admin")) return true;
  if (keyPermissions.includes(required)) return true;
  const rolePerms = ROLE_PERMISSIONS[userRole] ?? [];
  return rolePerms.includes(required as Permission);
}
