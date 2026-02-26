"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const LoginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter no minimo 6 caracteres"),
});

export async function signIn(formData: FormData): Promise<void> {
  const result = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    redirect(
      "/painel/acesso?error=" +
        encodeURIComponent(result.error.issues[0].message),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  });

  if (error) {
    redirect(
      "/painel/acesso?error=" + encodeURIComponent("Credenciais invalidas"),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      "/painel/acesso?error=" +
        encodeURIComponent("Erro ao verificar perfil"),
    );
  }

  // Use service-role client to bypass RLS for the role check
  // (RLS auth.uid() may not be set yet in the same server action)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    (profile.role !== "business" && profile.role !== "super_admin")
  ) {
    await supabase.auth.signOut();
    redirect(
      "/painel/acesso?error=" +
        encodeURIComponent("Acesso restrito a lojistas e administradores"),
    );
  }

  revalidatePath("/painel");
  redirect(
    profile.role === "super_admin"
      ? "/painel/super/dashboard"
      : "/painel/dashboard",
  );
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/painel");
  redirect("/painel/acesso");
}
