import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

interface AttributeTooltipProps {
  term: string;
  definition: string;
}

export function AttributeTooltip({ term, definition }: AttributeTooltipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${term}: ${definition}`}
            className="inline-flex cursor-help appearance-none items-center gap-0.5 border-x-0 border-b border-t-0 border-dotted border-slate-400 bg-transparent p-0 text-inherit transition-colors hover:border-blue-500 hover:text-blue-700 focus-visible:rounded-sm focus-visible:border-blue-600 focus-visible:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/25"
          >
            {term}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
