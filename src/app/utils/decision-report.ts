import type { GoStopTweakDecision } from './go-stop-tweak-engine';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] ?? character);
}

export function buildDecisionReportHtml(input: {
  foodType: string;
  decisions: GoStopTweakDecision[];
  generatedAt?: Date;
}) {
  const generatedAt = input.generatedAt ?? new Date();
  const rows = input.decisions.map(decision => `
    <tr>
      <td>${escapeHtml(decision.sampleName)}</td>
      <td>${escapeHtml(decision.sampleId)}</td>
      <td><strong>${decision.decision}</strong></td>
      <td>${decision.issfScore.toFixed(1)}</td>
      <td>${decision.confidenceScore.toFixed(0)}%</td>
      <td>${escapeHtml(decision.recommendation)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(input.foodType)} decision report</title>
<style>
body{font-family:Arial,sans-serif;color:#172033;margin:40px}h1{font-size:24px}p{color:#526070}
table{width:100%;border-collapse:collapse;margin-top:24px;font-size:12px}th,td{padding:10px;border:1px solid #d9dee7;text-align:left;vertical-align:top}
th{background:#f2f4f7}.meta{margin-top:8px;font-size:12px}@media print{body{margin:18mm}}
</style></head><body>
<h1>${escapeHtml(input.foodType)} sensory decision report</h1>
<p class="meta">Generated ${generatedAt.toLocaleString()} | ${input.decisions.length} formulation${input.decisions.length === 1 ? '' : 's'}</p>
<table><thead><tr><th>Sample</th><th>ID</th><th>Decision</th><th>ISSF</th><th>Confidence</th><th>Recommendation</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}

export function downloadDecisionReport(html: string, filename: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
