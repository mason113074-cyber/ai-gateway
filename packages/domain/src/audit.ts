export interface AuditEntry {
  id?: string;
  eventType: string;
  actorType: "agent" | "user" | "system";
  actorId: string;
  targetType?: string;
  targetId?: string;
  action: string;
  outcome: "success" | "denied" | "error";
  metadata?: Record<string, unknown>;
}

export interface AuditLogger {
  log(workspaceId: string, entry: Omit<AuditEntry, "id">): void | Promise<void>;
  query(opts: {
    workspaceId: string;
    eventType?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }):
    | { items: (AuditEntry & { timestamp: string })[]; total: number }
    | Promise<{ items: (AuditEntry & { timestamp: string })[]; total: number }>;
}
