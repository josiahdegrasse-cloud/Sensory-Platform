import { supabase } from '../supabase';

// Best-effort: emails are a courtesy, not a guarantee. If the
// notify-survey-assignment function isn't deployed or email isn't configured
// (no RESEND_API_KEY), this quietly no-ops so survey/assignment mutations
// never fail because of it.
export async function notifyPanelistsOfSurveys(panelistIds: string[], surveyNames: string[]): Promise<void> {
  const ids = Array.from(new Set(panelistIds.filter(Boolean)));
  const names = surveyNames.filter(Boolean);
  if (ids.length === 0 || names.length === 0) return;

  try {
    await supabase.functions.invoke('notify-survey-assignment', {
      body: { panelistIds: ids, surveyNames: names, signInUrl: window.location.origin },
    });
  } catch (err) {
    console.error('Failed to send survey notification emails', err);
  }
}
