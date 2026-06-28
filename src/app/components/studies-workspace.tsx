import { ProjectHeader } from './project-header';
import { AdminConfig } from './admin-config';

export function StudiesWorkspace() {
  return (
    <div className="space-y-6">
      <ProjectHeader />
      <AdminConfig mode="studies" />
    </div>
  );
}
