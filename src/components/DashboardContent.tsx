import { PropertyWithImages } from "@/hooks/useProperties";
import { DashboardView } from "@/components/dashboard/DashboardView";

interface DashboardContentProps {
  properties: PropertyWithImages[];
  loading: boolean;
  onNavigateToAgenda?: () => void;
  onNavigateToReports?: () => void;
  onNavigateToPipeline?: () => void;
  onNavigateToUsers?: () => void;
}

/** Thin orchestrator — cream Painel lives in `components/dashboard/`. */
export function DashboardContent({
  onNavigateToAgenda,
  onNavigateToReports,
  onNavigateToPipeline,
  onNavigateToUsers,
}: DashboardContentProps) {
  return (
    <DashboardView
      onNavigateToAgenda={onNavigateToAgenda}
      onNavigateToReports={onNavigateToReports}
      onNavigateToPipeline={onNavigateToPipeline}
      onNavigateToUsers={onNavigateToUsers}
    />
  );
}
