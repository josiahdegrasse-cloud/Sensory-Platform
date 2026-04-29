import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { JARGON_GLOSSARY } from "../data/quality-standards";

interface JargonTooltipProps {
  term: keyof typeof JARGON_GLOSSARY;
  children?: React.ReactNode;
}

export function JargonTooltip({ term, children }: JargonTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children ? (
            <span className="underline decoration-dotted decoration-slate-400 cursor-help">
              {children}
            </span>
          ) : (
            <Info className="size-4 text-slate-400 inline-block cursor-help" />
          )}
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <div className="space-y-1">
            <div className="font-bold text-sm">{term}</div>
            <p className="text-xs text-slate-200">{JARGON_GLOSSARY[term]}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
