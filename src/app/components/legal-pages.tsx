import { ArrowLeft, FileText, Scale, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const effectiveDate = 'June 5, 2026';

function LegalShell({ title, subtitle, icon: Icon, children }: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft className="size-4" />
          Back to sign in
        </a>
        <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-7">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-slate-900 p-2.5 text-white">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Effective {effectiveDate}</p>
                <h1 className="mt-1 text-3xl font-bold text-slate-900">{title}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
              </div>
            </div>
          </div>
          <div className="space-y-7 p-7 text-sm leading-6 text-slate-700">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle="How the sensory platform handles account, questionnaire, and research response data."
      icon={ShieldCheck}
    >
      <Section title="Information We Collect">
        <p>We collect account details such as name and email, panelist identifiers, food-allergy and medically required avoidance declarations, assigned study activity, questionnaire responses, product ratings, comments, concept feedback, timestamps, and technical metadata needed to operate the platform.</p>
      </Section>
      <Section title="How We Use Information">
        <p>Data is used to administer sensory studies, assign surveys, analyze food product performance, generate reports, improve study design, and maintain platform security and reliability.</p>
      </Section>
      <Section title="Who Can Access It">
        <p>Authorized study administrators may access panelist and study data for research operations. They may review a panelist's safety declaration when preparing or verifying a study; each declaration view is logged. Panelists can access their own assigned questionnaires and submissions where the product allows it.</p>
      </Section>
      <Section title="Retention and Deletion">
        <p>Study data is retained while it is needed for research, quality, audit, or business purposes. Panelists may contact the study administrator to ask about access, correction, or deletion of their data.</p>
      </Section>
      <Section title="Security">
        <p>The platform uses authenticated access controls and database policies to limit access. No system is risk-free, so administrators should avoid uploading unnecessary personal or sensitive information.</p>
      </Section>
      <Section title="Contact">
        <p>Questions about privacy, consent, or data handling should be directed to the study administrator or organization operating this workspace.</p>
      </Section>
    </LegalShell>
  );
}

export function TermsOfUse() {
  return (
    <LegalShell
      title="Terms of Use"
      subtitle="Rules for using the sensory platform as an administrator or panelist."
      icon={Scale}
    >
      <Section title="Permitted Use">
        <p>Use the platform only for legitimate sensory research, product development, and study administration. Do not attempt to access data or features that were not assigned to you.</p>
      </Section>
      <Section title="Account Responsibility">
        <p>You are responsible for keeping your login credentials secure and for signing out on shared devices. Notify the study administrator if you believe your account has been accessed without permission.</p>
      </Section>
      <Section title="Data Quality">
        <p>Panelists should provide honest responses based on their experience. Administrators are responsible for ensuring uploaded files and study materials are appropriate, accurate, and authorized.</p>
      </Section>
      <Section title="Restrictions">
        <p>Do not misuse the platform, upload unlawful content, interfere with security controls, scrape confidential research data, or use the service to identify panelists unless your organization has a lawful reason to do so.</p>
      </Section>
      <Section title="Changes">
        <p>The platform and these terms may be updated as the product grows. Continued use after an update may require renewed consent or acceptance.</p>
      </Section>
    </LegalShell>
  );
}

export function PanelistConsentContent() {
  return (
    <>
      <Section title="Purpose">
        <p>You are being asked to participate in food sensory research. Your responses help evaluate products, compare samples, improve concepts, and guide product development decisions.</p>
      </Section>
      <Section title="What Participation Involves">
        <p>You may be asked to complete surveys about appearance, aroma, flavor, texture, liking, emotions, purchase intent, comments, or similar sensory and concept questions.</p>
      </Section>
      <Section title="Voluntary Participation">
        <p>Participation is voluntary. You may stop participating at any time and contact the study administrator with questions about your participation or data.</p>
      </Section>
      <Section title="Risks and Discomforts">
        <p>Some studies may involve tasting food products. Follow all study instructions, allergen disclosures, and safety guidance provided outside the platform by the study administrator.</p>
      </Section>
      <Section title="Confidentiality">
        <p>Your responses are used for research and reporting by authorized administrators. Reports may combine responses across panelists when evaluating product performance.</p>
      </Section>
      <Section title="Food Safety Information">
        <p>Your allergy and medically required avoidance declaration is used to exclude unsuitable samples automatically. Authorized study administrators may also review it when preparing or verifying a study. Each declaration view is logged, and viewing the record does not allow an administrator to override the safety filters.</p>
      </Section>
      <Section title="Agreement">
        <p>By accepting consent in the platform, you confirm that you understand this information and agree to participate under these terms.</p>
      </Section>
    </>
  );
}

export function PanelistConsent() {
  return (
    <LegalShell
      title="Panelist Consent"
      subtitle="What panelists agree to before completing questionnaires and concept surveys."
      icon={FileText}
    >
      <PanelistConsentContent />
    </LegalShell>
  );
}
