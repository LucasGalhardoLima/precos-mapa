import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse("Token ausente.", { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("notification_preferences")
    .update({ email_digest: false, updated_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("user_id")
    .single();

  if (error || !data) {
    return new NextResponse(
      "<html><body style='font-family:sans-serif;text-align:center;padding:60px'>" +
        "<h1>Link inválido</h1>" +
        "<p>Este link de cancelamento não é válido ou já foi utilizado.</p>" +
        "</body></html>",
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  // Rotate unsubscribe token so old links can't be replayed
  await supabase
    .from("notification_preferences")
    .update({ unsubscribe_token: crypto.randomUUID() })
    .eq("user_id", data.user_id);

  return new NextResponse(
    "<html><body style='font-family:sans-serif;text-align:center;padding:60px'>" +
      "<h1>Inscrição cancelada</h1>" +
      "<p>Você não receberá mais o resumo diário por e-mail.</p>" +
      "<p style='color:#999;font-size:13px'>Você pode reativar a qualquer momento nas configurações do app.</p>" +
      "</body></html>",
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
