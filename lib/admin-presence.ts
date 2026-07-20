import type { SupabaseClient } from "@supabase/supabase-js";

export const ONLINE_WINDOW_MS = 75_000;

export type AdminPresence = {
  userId: string;
  lastSeenAt: string;
  online: boolean;
};

type PresenceRow = {
  user_id: string;
  last_seen_at: string;
};

function isMissingPresenceTable(
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

export async function loadAdminPresence(
  adminClient: SupabaseClient,
): Promise<{
  presence: AdminPresence[];
  available: boolean;
}> {
  const {
    data,
    error,
  } = await adminClient
    .from("user_presence")
    .select("user_id, last_seen_at");

  if (error) {
    if (isMissingPresenceTable(error)) {
      return {
        presence: [],
        available: false,
      };
    }

    throw new Error(
      `Online-Status konnte nicht geladen werden: ${error.message}`,
    );
  }

  const now = Date.now();
  const presence = (
    (data ?? []) as PresenceRow[]
  ).map((row) => {
    const lastSeenTime = new Date(
      row.last_seen_at,
    ).getTime();

    return {
      userId: row.user_id,
      lastSeenAt: row.last_seen_at,
      online:
        Number.isFinite(lastSeenTime) &&
        now - lastSeenTime <=
          ONLINE_WINDOW_MS,
    };
  });

  return {
    presence,
    available: true,
  };
}
