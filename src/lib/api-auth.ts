import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { User } from "@supabase/supabase-js";

type AuthResult =
  | { user: User; error: null }
  | { user: null; error: NextResponse };

/**
 * Validate Supabase JWT from Authorization: Bearer header.
 * Returns the authenticated user or a 401 JSON response.
 */
export async function requireApiAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Token de acesso obrigatório." },
        { status: 401 },
      ),
    };
  }

  const token = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await getSupabaseAdmin().auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Token inválido ou expirado." },
        { status: 401 },
      ),
    };
  }

  return { user, error: null };
}
