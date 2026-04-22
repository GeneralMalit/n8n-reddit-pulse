import { DashboardApp } from "@/components/dashboard-app";
import { loadDashboardData } from "@/lib/redditpulse";

export const dynamic = "force-dynamic";

export default async function Home() {
  const dashboard = await loadDashboardData();

  return <DashboardApp initialData={dashboard} />;
}
