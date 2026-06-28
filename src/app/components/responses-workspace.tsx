import { ProjectHeader } from './project-header';
import { AdminConfig } from './admin-config';

export function ResponsesWorkspace() {
  return (
    <div className="space-y-6">
      <ProjectHeader />
      <AdminConfig mode="responses" />
    </div>
  );
}
