import { useParams } from 'react-router';
import { AdminConfig } from './admin-config';
import { StudiesNavigation } from './studies-navigation';

export function PanelistsWorkspace() {
  const { projectId } = useParams<{ projectId?: string }>();

  return (
    <AdminConfig
      mode="panelists"
      secondaryNavigation={projectId ? <StudiesNavigation projectId={projectId} active="panelists" /> : undefined}
    />
  );
}
