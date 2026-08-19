import { ClipboardList, PackageCheck, Users } from 'lucide-react';
import { Link } from 'react-router';
import { projectStudiesPath } from '../lib/project-journey-routes';

export function StudiesNavigation({
  projectId,
  active,
}: {
  projectId: string;
  active: 'studies' | 'panelists' | 'ship-outs';
}) {
  const items = [
    { id: 'studies' as const, label: 'Studies', icon: ClipboardList, to: projectStudiesPath(projectId) },
    { id: 'panelists' as const, label: 'Panelists', icon: Users, to: projectStudiesPath(projectId, 'panelists') },
    { id: 'ship-outs' as const, label: 'Ship-outs', icon: PackageCheck, to: projectStudiesPath(projectId, 'ship-outs') },
  ];

  return (
    <nav className="flex items-center gap-1 border-b border-slate-200" aria-label="Studies sections">
      {items.map(item => {
        const Icon = item.icon;
        const selected = item.id === active;
        return (
          <Link
            key={item.id}
            to={item.to}
            aria-current={selected ? 'page' : undefined}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              selected
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
