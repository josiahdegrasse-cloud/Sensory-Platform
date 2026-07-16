import { AdminConfig } from './admin-config';
import { useParams } from 'react-router';
import { StudiesNavigation } from './studies-navigation';
import { FormulationContextStrip } from './formulation-context-strip';

export function StudiesWorkspace() {
  const { projectId } = useParams<{ projectId?: string }>();

  return (
    <div className="space-y-6">
      <AdminConfig
        mode="studies"
        secondaryNavigation={projectId ? (
          <div className="space-y-4">
            <StudiesNavigation projectId={projectId} active="studies" />
            <FormulationContextStrip projectId={projectId} context="ship-outs" />
          </div>
        ) : undefined}
      />
    </div>
  );
}
