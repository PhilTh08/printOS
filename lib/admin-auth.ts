import type {
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export class AdminApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

export type AdminRequestContext = {
  adminClient: SupabaseClient;
  adminUser: User;
};

type AuditInput = {
  action: string;
  targetUserId?: string | null;
  entityType?: string | null;
  entityId?: string | number | null;
  reason: string;
  beforeData?: unknown;
  details?: Record<string, unknown>;
};

function bearerToken(request: NextRequest): string {
  const authorization =
    request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token
  ) {
    throw new AdminApiError(
      401,
      "Anmeldung für den Adminbereich fehlt.",
    );
  }

  return token;
}

export async function requireAdmin(
  request: NextRequest,
): Promise<AdminRequestContext> {
  const token = bearerToken(request);
  const adminClient = getSupabaseAdmin();
  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    throw new AdminApiError(
      401,
      "Die Admin-Sitzung ist ungültig oder abgelaufen.",
    );
  }

  const { data: roleRow, error: roleError } =
    await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

  if (roleError) {
    throw new AdminApiError(
      500,
      `Adminrolle konnte nicht geprüft werden: ${roleError.message}`,
    );
  }

  if (!roleRow) {
    throw new AdminApiError(
      403,
      "Dieser Account besitzt keine Adminberechtigung.",
    );
  }

  return {
    adminClient,
    adminUser: user,
  };
}

export async function beginAdminAction(
  context: AdminRequestContext,
  input: AuditInput,
): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await context.adminClient
    .from("admin_action_logs")
    .insert({
      id,
      admin_user_id: context.adminUser.id,
      target_user_id: input.targetUserId ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id:
        input.entityId === null ||
        input.entityId === undefined
          ? null
          : String(input.entityId),
      reason: input.reason,
      status: "pending",
      before_data: input.beforeData ?? null,
      after_data: null,
      details: input.details ?? {},
      error_message: null,
    });

  if (error) {
    throw new AdminApiError(
      500,
      `Adminaktion konnte nicht protokolliert werden: ${error.message}`,
    );
  }

  return id;
}

export async function finishAdminAction(
  context: AdminRequestContext,
  auditId: string,
  options: {
    status: "success" | "failed";
    afterData?: unknown;
    errorMessage?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const update: Record<string, unknown> = {
    status: options.status,
    completed_at: new Date().toISOString(),
    after_data: options.afterData ?? null,
    error_message: options.errorMessage ?? null,
  };

  if (options.details) {
    update.details = options.details;
  }

  const { error } = await context.adminClient
    .from("admin_action_logs")
    .update(update)
    .eq("id", auditId)
    .eq("admin_user_id", context.adminUser.id);

  if (error) {
    throw new AdminApiError(
      500,
      `Adminprotokoll konnte nicht abgeschlossen werden: ${error.message}`,
    );
  }
}

export async function recordAdminRead(
  context: AdminRequestContext,
  input: AuditInput,
): Promise<void> {
  const auditId = await beginAdminAction(
    context,
    input,
  );

  await finishAdminAction(
    context,
    auditId,
    {
      status: "success",
      details: input.details,
    },
  );
}

export function adminErrorResponse(
  error: unknown,
): NextResponse {
  if (error instanceof AdminApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  const message =
    error instanceof Error
      ? error.message
      : "Unbekannter Adminfehler.";

  return NextResponse.json(
    { error: message },
    { status: 500 },
  );
}

export function requireReason(
  value: unknown,
): string {
  const reason =
    typeof value === "string" ? value.trim() : "";

  if (reason.length < 5) {
    throw new AdminApiError(
      400,
      "Bitte einen nachvollziehbaren Supportgrund mit mindestens 5 Zeichen angeben.",
    );
  }

  return reason.slice(0, 500);
}

export function isMissingOrdersTable(
  error: unknown,
): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }

  const code =
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";

  return (
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205"
  );
}
