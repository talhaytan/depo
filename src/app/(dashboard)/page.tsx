import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardMetrics } from "@/lib/dashboard";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/giris");
  }

  const metrics = await getDashboardMetrics();

  return <DashboardClient initialData={metrics} user={user} />;
}
