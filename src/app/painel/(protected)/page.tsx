import { redirect } from "next/navigation";
import { requireSessionContext } from "@/features/auth/session";

export default async function PainelIndexPage() {
  const session = await requireSessionContext();

  if (session.role === "super_admin") {
    redirect("/painel/super/dashboard");
  }

  redirect("/painel/dashboard");
}
