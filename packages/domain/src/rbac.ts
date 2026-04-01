export const PERMISSIONS = {
  proxy: "Can make proxy requests to LLM providers",
  "read:agents": "Can view agents",
  "read:logs": "Can view proxy logs",
  "read:audit": "Can view audit logs",
  "read:costs": "Can view cost data",
  "read:keys": "Can list API keys",
  "read:rate-limits": "Can view rate limit configs and status",
  "write:agents": "Can create/update agents",
  "write:budgets": "Can set/modify budgets",
  "write:rate-limits": "Can create/update/delete rate limit configs",
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
    "read:agents",
    "read:logs",
    "read:audit",
    "read:costs",
    "read:rate-limits",
    "write:agents",
    "write:budgets",
    "write:rate-limits",
  ],
  viewer: ["read:agents", "read:logs", "read:audit", "read:costs", "read:rate-limits"],
};

const LEGACY_PERMISSION_ALIASES: Record<string, string[]> = {
  "read:agents": ["read:logs"],
  "read:keys": ["manage:keys"],
  "read:rate-limits": ["read:costs"],
  "write:rate-limits": ["write:budgets"],
};

export type Role = keyof typeof ROLE_PERMISSIONS;

export function hasPermission(
  userRole: string,
  keyPermissions: string[],
  required: string
): boolean {
  const aliases = LEGACY_PERMISSION_ALIASES[required] ?? [];
  if (keyPermissions.includes("admin")) return true;
  if (keyPermissions.includes(required)) return true;
  if (aliases.some((alias) => keyPermissions.includes(alias))) return true;
  const rolePerms = ROLE_PERMISSIONS[userRole] ?? [];
  if (rolePerms.includes(required as Permission)) return true;
  return aliases.some((alias) => rolePerms.includes(alias as Permission));
}
