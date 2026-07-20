import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(
  message = "Nicht angemeldet.",
) {
  return NextResponse.json(
    { error: message },
    { status: 401 },
  );
}

function readBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get(
      "authorization",
    );

  if (
    !authorization?.startsWith(
      "Bearer ",
    )
  ) {
    return null;
  }

  const token = authorization
    .slice("Bearer ".length)
    .trim();

  return token || null;
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    const token =
      readBearerToken(request);

    if (!token) {
      return unauthorized();
    }

    const adminClient =
      getSupabaseAdmin();
    const {
      data: userData,
      error: userError,
    } = await adminClient.auth.getUser(
      token,
    );

    if (
      userError ||
      !userData.user
    ) {
      return unauthorized(
        "Deine Sitzung ist nicht mehr gültig.",
      );
    }

    const body = (await request.json()) as {
      email?: unknown;
      confirmation?: unknown;
    };

    const email =
      typeof body.email === "string"
        ? body.email.trim()
        : "";
    const confirmation =
      typeof body.confirmation ===
      "string"
        ? body.confirmation.trim()
        : "";

    if (
      confirmation !==
      "KONTO LÖSCHEN"
    ) {
      return NextResponse.json(
        {
          error:
            "Die Sicherheitsbestätigung ist nicht korrekt.",
        },
        { status: 400 },
      );
    }

    if (
      !userData.user.email ||
      email.toLowerCase() !==
        userData.user.email.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error:
            "Die eingegebene E-Mail-Adresse stimmt nicht mit dem Konto überein.",
        },
        { status: 400 },
      );
    }

    const {
      error: deleteError,
    } =
      await adminClient.auth.admin.deleteUser(
        userData.user.id,
        false,
      );

    if (deleteError) {
      return NextResponse.json(
        {
          error:
            deleteError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      deleted: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Konto konnte nicht gelöscht werden.",
      },
      { status: 500 },
    );
  }
}
