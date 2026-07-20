import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin-auth";
import { loadAdminPresence } from "@/lib/admin-presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const context =
      await requireAdmin(request);
    const result =
      await loadAdminPresence(
        context.adminClient,
      );

    return NextResponse.json(result);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
