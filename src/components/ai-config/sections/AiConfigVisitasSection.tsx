import { AiVisitSchedulingCard } from '@/components/AiVisitSchedulingCard';
import { PendingVisitBrokerAssignments } from '@/components/PendingVisitBrokerAssignments';
import type { AiVisitSchedulingConfig } from '@/lib/aiVisitScheduling';

type AiConfigVisitasSectionProps = {
  companyId?: string;
  isManager: boolean;
  initialConfig: AiVisitSchedulingConfig;
  externalSaving: boolean;
  onSave: (config: AiVisitSchedulingConfig) => Promise<boolean>;
};

export function AiConfigVisitasSection({
  companyId,
  isManager,
  initialConfig,
  externalSaving,
  onSave,
}: AiConfigVisitasSectionProps) {
  return (
    <div className="space-y-4">
      <AiVisitSchedulingCard
        companyId={companyId}
        isManager={isManager}
        initialConfig={initialConfig}
        externalSaving={externalSaving}
        onSave={onSave}
      />
      <PendingVisitBrokerAssignments />
    </div>
  );
}
