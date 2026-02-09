import { redirect } from "next/navigation";
import { requireSessionContext } from "@/features/auth/session";

export default async function SuperSectionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSessionContext();

  if (session.role !== "super_admin") {
    redirect("/painel/dashboard");
  }

  return children;
}
