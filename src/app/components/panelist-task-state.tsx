import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function PanelistTaskLoading({ message }: { message: string }) {
  return (
    <Card className="mx-auto max-w-2xl border-slate-200 bg-white" aria-live="polite">
      <CardContent className="py-12 text-center text-sm text-slate-600">{message}</CardContent>
    </Card>
  );
}

export function PanelistTaskUnavailable({
  message,
  onBack,
  onRetry,
}: {
  message: string;
  onBack: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <div className="flex flex-col gap-2 sm:flex-row">
        {onRetry && <Button className="flex-1" onClick={onRetry}>Try again</Button>}
        <Button variant="outline" className="flex-1" onClick={onBack}>Back to task list</Button>
      </div>
    </div>
  );
}

export function PanelistSubmissionSuccess({
  title,
  message,
  warning,
  onBack,
}: {
  title: string;
  message: ReactNode;
  warning?: string;
  onBack: () => void;
}) {
  return (
    <Card className="mx-auto max-w-2xl border-emerald-300 bg-emerald-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-950">
          <CheckCircle2 className="size-6 text-emerald-700" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-slate-700">{message}</p>
        {warning ? (
          <>
            <Alert className="border-amber-300 bg-amber-50">
              <AlertCircle className="size-4" />
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
            <Button className="w-full" onClick={onBack}>Return to task list</Button>
          </>
        ) : (
          <p className="text-xs text-slate-600" aria-live="polite">Returning to your task list…</p>
        )}
      </CardContent>
    </Card>
  );
}
