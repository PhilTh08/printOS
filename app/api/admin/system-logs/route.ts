import { NextRequest, NextResponse } from "next/server";

import {
  adminErrorResponse,
  recordAdminRead,
  requireAdmin,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdmin(request);
    const url = new URL(request.url);
    const category = url.searchParams.get("category")?.trim() || "all";
    const status = url.searchParams.get("status")?.trim() || "all";
    const query = url.searchParams.get("q")?.trim().toLowerCase() || "";

    const [auditResult, eventResult, usersResult] = await Promise.all([
      context.adminClient
        .from("admin_action_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      context.adminClient
        .from("app_event_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      context.adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (auditResult.error) throw new Error(auditResult.error.message);
    if (eventResult.error) throw new Error(eventResult.error.message);
    if (usersResult.error) throw new Error(usersResult.error.message);

    const emailById = new Map(
      usersResult.data.users.map((user) => [user.id, user.email ?? user.id]),
    );

    const adminLogs = (auditResult.data ?? []).map((row) => ({
      id: `admin:${row.id}`,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      category: String(row.entity_type || "admin"),
      source: "admin",
      action: row.action,
      message: row.reason,
      status: row.status,
      actor: row.admin_user_id
        ? emailById.get(String(row.admin_user_id)) ?? "Gelöschter Admin"
        : "System",
      target: row.target_user_id
        ? emailById.get(String(row.target_user_id)) ?? "Gelöschter Benutzer"
        : row.entity_id || null,
      details: row.details ?? {},
      errorMessage: row.error_message,
    }));

    const eventLogs = (eventResult.data ?? []).map((row) => ({
      id: `event:${row.id}`,
      createdAt: row.created_at,
      completedAt: null,
      category: row.category,
      source: "app",
      action: row.action,
      message: row.message,
      status: "success",
      actor: row.user_id
        ? emailById.get(String(row.user_id)) ?? "Gelöschter Benutzer"
        : "System",
      target: row.entity_id || null,
      details: row.details ?? {},
      errorMessage: null,
    }));

    let logs = [...adminLogs, ...eventLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    if (category !== "all") {
      logs = logs.filter((entry) => entry.category === category);
    }
    if (status !== "all") {
      logs = logs.filter((entry) => entry.status === status);
    }
    if (query) {
      logs = logs.filter((entry) =>
        `${entry.actor} ${entry.action} ${entry.message} ${entry.target ?? ""}`
          .toLowerCase()
          .includes(query),
      );
    }

    await recordAdminRead(context, {
      action: "system_logs.view",
      reason: "Zentralen System-Log geöffnet",
      details: { resultCount: logs.length, category, status },
    });

    return NextResponse.json({ logs: logs.slice(0, 500) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
