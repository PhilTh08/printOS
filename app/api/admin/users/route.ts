import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  adminErrorResponse,
  recordAdminRead,
  requireAdmin,
} from "@/lib/admin-auth";
import { loadAdminPresence } from "@/lib/admin-presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function displayName(
  metadata: Record<string, unknown> | null | undefined,
  email: string | undefined,
): string {
  const fullName = metadata?.full_name;
  const name = metadata?.name;

  if (
    typeof fullName === "string" &&
    fullName.trim()
  ) {
    return fullName.trim();
  }

  if (
    typeof name === "string" &&
    name.trim()
  ) {
    return name.trim();
  }

  return email?.split("@")[0] ?? "Benutzer";
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdmin(request);
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

    const { data: roleRows, error: rolesError } =
      await context.adminClient
        .from("user_roles")
        .select("user_id, role");

    if (rolesError) {
      throw new Error(rolesError.message);
    }

    const adminIds = new Set(
      (roleRows ?? [])
        .filter((row) => row.role === "admin")
        .map((row) => String(row.user_id)),
    );
    const presenceResult =
      await loadAdminPresence(
        context.adminClient,
      );
    const presenceByUserId = new Map(
      presenceResult.presence.map(
        (entry) => [
          entry.userId,
          entry,
        ],
      ),
    );

    const responseUsers = users
      .map((user) => {
        const bannedUntil = user.banned_until ?? null;
        const locked = Boolean(
          bannedUntil &&
            new Date(bannedUntil).getTime() >
              Date.now(),
        );

        const presence =
          presenceByUserId.get(user.id);

        return {
          id: user.id,
          email: user.email ?? "",
          displayName: displayName(
            user.user_metadata,
            user.email,
          ),
          createdAt: user.created_at,
          lastSignInAt:
            user.last_sign_in_at ?? null,
          emailConfirmedAt:
            user.email_confirmed_at ?? null,
          bannedUntil,
          locked,
          isAdmin: adminIds.has(user.id),
          isCurrentAdmin:
            user.id === context.adminUser.id,
          online:
            presence?.online ?? false,
          lastSeenAt:
            presence?.lastSeenAt ?? null,
        };
      })
      .sort((first, second) => {
        if (first.isAdmin !== second.isAdmin) {
          return first.isAdmin ? -1 : 1;
        }

        return first.email.localeCompare(
          second.email,
          "de",
        );
      });

    await recordAdminRead(context, {
      action: "users.list.view",
      reason: "Admin-Nutzerliste geöffnet",
      details: {
        resultCount: responseUsers.length,
      },
    });

    return NextResponse.json({
      users: responseUsers,
      currentAdminId:
        context.adminUser.id,
      presenceAvailable:
        presenceResult.available,
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
