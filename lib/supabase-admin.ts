import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL fehlt auf dem Server.",
    );
  }

  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY oder SUPABASE_SERVICE_ROLE_KEY fehlt in den Server-Umgebungsvariablen.",
    );
  }

  cachedAdminClient = createClient(
    supabaseUrl,
    secretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  return cachedAdminClient;
}
