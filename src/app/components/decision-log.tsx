import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ClipboardCheck } from "lucide-react";
import { fetchDecisionRecords, type DecisionRecord } from "../lib/database";

const DECISION_COLORS: Record<string, string> = {
  GO: "bg-emerald-600",
  TWEAK: "bg-amber-500",
  STOP: "bg-rose-600",
};

const DECISION_LABEL: Record<string, string> = {
  GO: "▲ GO",
  TWEAK: "◆ TWEAK",
  STOP: "■ STOP",
};

export function DecisionLog({ refreshKey }: { refreshKey: number }) {
  const [log, setLog] = useState<DecisionRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    fetchDecisionRecords()
      .then(records => {
        if (!cancelled) setLog(records);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load decision history.");
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (log.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="size-5 text-slate-400" />
            Decision Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 text-center py-4">
            {error || 'No decisions logged yet. Confirm a GO, TWEAK, or STOP decision to create an immutable audit record.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardCheck className="size-5 text-blue-600" />
          Decision Audit Trail
          <span className="text-sm font-normal text-slate-500">({log.length} entries)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="pb-2 font-semibold text-slate-600 pr-4">Time</th>
                <th className="pb-2 font-semibold text-slate-600 pr-4">Sample</th>
                <th className="pb-2 font-semibold text-slate-600 pr-4">Decision</th>
                <th className="pb-2 font-semibold text-slate-600 pr-4">ISSF</th>
                <th className="pb-2 font-semibold text-slate-600 pr-4">Confidence</th>
                <th className="pb-2 font-semibold text-slate-600 pr-4">By</th>
                <th className="pb-2 font-semibold text-slate-600">Note</th>
              </tr>
            </thead>
            <tbody>
              {log.map(entry => {
                const dt = new Date(entry.timestamp);
                const dateStr = dt.toLocaleDateString();
                const timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 pr-4 text-slate-500 whitespace-nowrap text-xs">
                      <div>{dateStr}</div>
                      <div className="text-slate-400">{timeStr}</div>
                    </td>
                    <td className="py-2 pr-4 font-medium text-slate-900">{entry.sampleName}</td>
                    <td className="py-2 pr-4">
                      <Badge className={`${DECISION_COLORS[entry.decision]} text-white text-xs`}>
                        {DECISION_LABEL[entry.decision]}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 font-mono text-slate-700">{entry.issfScore.toFixed(1)}</td>
                    <td className="py-2 pr-4 text-slate-600">{entry.confidence.toFixed(0)}%</td>
                    <td className="py-2 pr-4 text-slate-600 text-xs">{entry.user}</td>
                    <td className="py-2 text-slate-500 text-xs italic max-w-[180px] truncate" title={entry.note}>{entry.note || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
