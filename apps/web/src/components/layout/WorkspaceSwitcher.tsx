import { Building2, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { useState, useRef, useEffect } from 'react';
import type { Workspace } from '@content-hub/shared';

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, switchWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (workspaces.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-2">
        <Building2 className="h-4 w-4 text-[#94A3B8]" />
        <span className="text-sm font-medium">
          {activeWorkspace?.name ?? 'Workspace'}
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2"
      >
        <Building2 className="h-4 w-4" />
        <span className="max-w-[150px] truncate">
          {activeWorkspace?.name ?? 'Workspace'}
        </span>
        <ChevronDown className="h-3 w-3" />
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md">
          {workspaces.map((ws: Workspace) => (
            <button
              key={ws.id}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => {
                void switchWorkspace(ws);
                setOpen(false);
              }}
            >
              {ws.id === activeWorkspace?.id && (
                <Check className="h-3 w-3 text-[#3B82F6]" />
              )}
              <span className={ws.id !== activeWorkspace?.id ? 'ml-5' : ''}>
                {ws.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
