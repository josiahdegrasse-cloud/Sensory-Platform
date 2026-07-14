import { AdminConfig } from './admin-config';
import { useParams } from 'react-router';
import { StudiesNavigation } from './studies-navigation';

export function StudiesWorkspace() {
  const { projectId } = useParams<{ projectId?: string }>();

  return (
    <div className="space-y-6">
      <AdminConfig
        mode="studies"
        secondaryNavigation={projectId ? <StudiesNavigation projectId={projectId} active="studies" /> : undefined}
      />
    </div>
  );
}
