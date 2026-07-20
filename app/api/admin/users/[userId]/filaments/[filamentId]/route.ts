import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  adminErrorResponse,
  AdminApiError,
  beginAdminAction,
  finishAdminAction,
  requireAdmin,
  requireReason,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    userId: string;
    filamentId: string;
  }>;
};

type CorrectionBody = {
  reason?: unknown;
  barcode?: unknown;
  manufacturer?: unknown;
  material?: unknown;
  color?: unknown;
  weightPerRoll?: unknown;
  location?: unknown;
  minimumStock?: unknown;
  stock?: unknown;
  orderLink?: unknown;
  imageUrl?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function integer(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new AdminApiError(
      400,
      "Eine Zahlenangabe ist ungültig.",
    );
  }

  return Math.min(
    maximum,
    Math.max(minimum, Math.round(parsed)),
  );
}

export async function PATCH(
  request: NextRequest,
  routeContext: RouteContext,
) {
  try {
    const context = await requireAdmin(request);
    const { userId, filamentId } =
      await routeContext.params;
    const numericFilamentId = Number(filamentId);

    if (!Number.isInteger(numericFilamentId)) {
      throw new AdminApiError(
        400,
        "Ungültige Filament-ID.",
      );
    }

    const body = (await request.json()) as CorrectionBody;
    const reason = requireReason(body.reason);
    const update = {
      barcode: text(body.barcode).replace(
        /[^0-9]/g,
        "",
      ),
      manufacturer: text(body.manufacturer),
      material: text(body.material),
      color: text(body.color),
      weight_per_roll: integer(
        body.weightPerRoll,
        1,
        50000,
      ),
      location: text(body.location),
      minimum_stock: integer(
        body.minimumStock,
        0,
        9999,
      ),
      stock: integer(body.stock, 0, 999999),
      order_link: text(body.orderLink),
      image_url: text(body.imageUrl),
    };

    if (
      !update.barcode ||
      !update.manufacturer ||
      !update.material ||
      !update.color
    ) {
      throw new AdminApiError(
        400,
        "EAN, Hersteller, Material und Farbe bleiben Pflichtfelder.",
      );
    }

    const { data: before, error: loadError } =
      await context.adminClient
        .from("filaments")
        .select("*")
        .eq("id", numericFilamentId)
        .eq("user_id", userId)
        .maybeSingle();

    if (loadError) {
      throw new Error(loadError.message);
    }

    if (!before) {
      throw new AdminApiError(
        404,
        "Filament wurde bei diesem Benutzer nicht gefunden.",
      );
    }

    const auditId = await beginAdminAction(context, {
      action: "filament.support_update",
      targetUserId: userId,
      entityType: "filament",
      entityId: numericFilamentId,
      reason,
      beforeData: before,
    });

    try {
      const { data: after, error: updateError } =
        await context.adminClient
          .from("filaments")
          .update(update)
          .eq("id", numericFilamentId)
          .eq("user_id", userId)
          .select("*")
          .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      await finishAdminAction(
        context,
        auditId,
        {
          status: "success",
          afterData: after,
        },
      );

      return NextResponse.json({
        filament: after,
      });
    } catch (error) {
      await finishAdminAction(
        context,
        auditId,
        {
          status: "failed",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unbekannter Fehler",
        },
      );
      throw error;
    }
  } catch (error) {
    return adminErrorResponse(error);
  }
}
