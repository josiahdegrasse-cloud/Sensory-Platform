import type { Product } from '../data/survey-domain';
import { getBlindStudyCategoryLabel, getBlindStudyDisplayName } from './blind-study';

export interface PackListRecipient {
  name: string;
  email?: string;
  lineNumber: number;
}

export interface PackListIssue {
  severity: 'error' | 'warning';
  message: string;
}

export interface PackListAnalysis {
  recipients: PackListRecipient[];
  issues: PackListIssue[];
  hasErrors: boolean;
}

export interface BoxTaskSummary {
  id: string;
  label: string;
  category: string;
  taskType: string;
  sampleCue: string;
  estimate: string;
  route: string;
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function analyzePackList(input: string): PackListAnalysis {
  const issues: PackListIssue[] = [];
  const recipients = input
    .split('\n')
    .map((rawLine, index) => ({ rawLine, lineNumber: index + 1, line: rawLine.trim() }))
    .filter(item => item.line.length > 0)
    .map(({ line, lineNumber }) => {
      const emailMatch = line.match(EMAIL_PATTERN);
      const email = emailMatch?.[0]?.toLowerCase();
      if (line.includes('@') && !email) {
        issues.push({ severity: 'error', message: `Line ${lineNumber} has an email that does not look valid.` });
      }
      const name = line
        .replace(/[<>()]/g, ' ')
        .replace(email ?? '', '')
        .replace(/[,;]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!email) {
        issues.push({ severity: 'warning', message: `Line ${lineNumber} has no email. The insert can print, but follow-up will be harder.` });
      }
      return {
        name: name || email || 'Unnamed panelist',
        email,
        lineNumber,
      };
    });

  const seenEmails = new Map<string, number>();
  recipients.forEach(recipient => {
    if (!recipient.email) return;
    const firstLine = seenEmails.get(recipient.email);
    if (firstLine) {
      issues.push({
        severity: 'error',
        message: `Lines ${firstLine} and ${recipient.lineNumber} use the same email.`,
      });
      return;
    }
    seenEmails.set(recipient.email, recipient.lineNumber);
  });

  return {
    recipients,
    issues,
    hasErrors: issues.some(issue => issue.severity === 'error'),
  };
}

export function recipientInputs(recipients: PackListRecipient[]): Array<{ name: string; email?: string }> {
  return recipients.map(({ name, email }) => ({ name, email }));
}

export function sampleCue(product: Product): string {
  if (product.isMultiSample && product.samples?.length) {
    const codes = product.samples.map(sample => sample.code || sample.label).filter(Boolean);
    if (codes.length > 0) return `Samples ${codes.join(', ')}`;
    return `${product.samples.length} coded samples`;
  }
  if (product.blinded && product.blindCode) return `Sample ${product.blindCode}`;
  if (product.sourceSampleId) return `Sample ${product.sourceSampleId}`;
  return product.blinded ? 'Coded sample in this box' : 'Single packaged sample';
}

export function taskEstimate(product: Product): string {
  if (product.isMultiSample && product.samples?.length) {
    const extraSamples = Math.max(0, product.samples.length - 3);
    return `${15 + extraSamples * 5}-${20 + extraSamples * 5} min`;
  }
  return '10-15 min';
}

export function taskSummary(product: Product): BoxTaskSummary {
  return {
    id: product.id,
    label: getBlindStudyDisplayName(product),
    category: getBlindStudyCategoryLabel(product),
    taskType: product.isMultiSample ? 'Multi-sample comparison' : 'Single product evaluation',
    sampleCue: sampleCue(product),
    estimate: taskEstimate(product),
    route: product.isMultiSample ? `/multi-sample-info/${product.id}` : `/questionnaire-info/${product.id}`,
  };
}

export function taskSummariesForIds(products: Product[], productIds: string[], fallbackProduct?: Product): BoxTaskSummary[] {
  const productMap = new Map(products.map(product => [product.id, product]));
  const summaries = productIds
    .map(id => productMap.get(id) ?? (fallbackProduct?.id === id ? fallbackProduct : undefined))
    .filter((product): product is Product => Boolean(product))
    .map(taskSummary);

  if (summaries.length === 0 && fallbackProduct) return [taskSummary(fallbackProduct)];
  return summaries;
}
