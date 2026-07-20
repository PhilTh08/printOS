import {
  NextRequest,
  NextResponse,
} from "next/server";

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
    const { data: auditRows, error: auditError } =
      await context.adminClient
        .from("admin_action_logs")
        .select("*")
        .order("created_at", {
          ascending: false,
        })
        .limit(250);

    if (auditError) {
      throw new Error(auditError.message);
    }

    const {
      data: { users },
      error: usersError,
    } = await context.adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) {
      throw new Error(usersError.message);
    }

    const emailById = new Map(
      users.map((user) => [
        user.id,
        user.email ?? user.id,
      ]),
    );

    const audit = (auditRows ?? []).map((row) => ({
      ...row,
      adminEmail:
        emailById.get(String(row.admin_user_id)) ??
        "Gelöschter Admin",
      targetEmail: row.target_user_id
        ? emailById.get(
            String(row.target_user_id),
          ) ?? "Gelöschter Benutzer"
        : null,
    }));

    await recordAdminRead(context, {
      action: "admin_audit.view",
      reason: "Admin-Aktionsprotokoll geöffnet",
      details: {
        resultCount: audit.length,
      },
    });

    return NextResponse.json({ audit });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
