/**
 * Audit Log Service
 *
 * Records sensitive actions to the audit_logs table.
 * Non-blocking: errors are logged to console but never throw.
 */

import prisma from "@/lib/db/prisma";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "VOUCHER_VALIDATE"
  | "VOUCHER_APPROVE"
  | "DETRACTION_PAY"
  | "DOWNLOAD_JOB_CREATE"
  | "REPORT_GENERATE"
  | "ALERT_MARK_READ"
  | "ALERT_MARK_ALL_READ"
  | "SYNC_MANUAL"
  | "SYNC_DAILY";

export interface AuditEntry {
  userId: string;
  companyId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        companyId: entry.companyId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        changes: entry.changes ? (entry.changes as object) : undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: entry.metadata ? (entry.metadata as object) : undefined,
      },
    });
  } catch (err) {
    // Audit failures must never break the main flow
    console.error("[Audit] Failed to write audit log:", err);
  }
}

/**
 * Extract request metadata for audit entries
 */
export function requestMeta(request: Request): { ipAddress: string; userAgent: string } {
  const ip =
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  return { ipAddress: ip, userAgent };
}
