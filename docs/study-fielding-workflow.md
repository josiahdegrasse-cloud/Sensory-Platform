# Study fielding and panelist box workflow

This is the operating workflow for product sensory and triangle studies. It
replaces the former implicit “active means created” behavior with a reviewed
launch boundary.

## R&D workflow

1. **Create a draft**
   - Manual studies and studies created from an import start as drafts
     (`status = draft`).
   - Drafts are visible to administrators only. An empty assignment list never
     means “open to all.”
2. **Configure the questionnaire**
   - Select at least one questionnaire section.
   - Intensity requires CATA. CATA requires at least one attribute.
   - Triangle tests require three unique coded servings representing exactly
     two underlying samples.
3. **Verify exact-sample safety**
   - Record and verify the allergen declaration for the physical sample that
     will be sent.
   - Re-verifying or superseding a declaration recalculates eligibility; an
     ineligible panelist cannot be assigned.
4. **Preview**
   - Use **Save & preview** in the study setup sheet. This persists the draft
     before opening the panelist view.
   - Administrator preview can exercise the flow but cannot submit a response.
5. **Assign eligible panelists**
   - Select from the filtered eligible roster. Excluded panelists are not
     exposed in the selector.
   - Assignment changes are saved with the draft and do not send notifications.
6. **Launch**
   - Launch activates the study in one status update after the configuration
     and assignments have been saved.
   - The database rejects activation unless questionnaire, sample declaration,
     panel assignment, eligibility, and triangle-structure requirements pass.
   - Notification email is best-effort and is requested only after activation
     succeeds.
7. **Monitor and close**
   - Monitor fielding in **Studies** and interpret completed evidence in
     **Insights**.
   - Close the study when no more responses should be accepted. Reopening
     returns to the same reviewed launch gate.
   - Restoring an archived product returns it to draft for review instead of
     making it immediately visible.

## Panelist box and QR workflow

1. Scan the unique QR code on the insert. If scanning fails, enter the printed
   fallback code at `/join`.
2. Sign in to the invited panelist account and claim the box pass.
3. Check the box or item cue before opening the sample. Report damage, a code
   mismatch, or a safety concern from the pass page before tasting.
4. Complete assigned tasks from top to bottom in **Your task inbox**.
5. Single-sample answers are saved in session storage while the form is open.
   Triangle-test progress is checkpointed in session storage across refreshes.
6. A triangle test writes all sample rows in one atomic database request. A
   failed request writes none of the rows, so retrying cannot create a partial
   triangle result.
7. After answers are saved, box completion is updated separately. If that
   follow-up fails, the panelist sees a warning that the answers are safe and is
   told to keep the insert and report the box code. They should not resubmit the
   questionnaire.

## Pass lifecycle

- `generated` → insert created
- `printed` → physical insert printed
- `packed` → box contents checked and sealed
- `shipped` → dispatched to the panelist
- `claimed` / `started` → panelist account claimed the pass or began a task
- `submitted` → every task assigned to the pass has a saved response
- `void` or `expired` → terminal; the pass cannot expose products or accept responses

An unresolved box issue blocks product access and completion until an
administrator resolves it. Expiry follows the study response deadline when one
is configured.

## Release verification

For changes to this workflow, run the migration-drift, generated-type,
tenant-isolation, type, unit, and production-build checks. Smoke-test one manual
draft and one import-created draft, including preview, eligibility, launch,
panelist visibility, QR and fallback-code entry, atomic response submission, and
final pass completion.

## Operator troubleshooting

- **Study cannot launch:** read the setup sheet's remaining requirements. If the
  interface looks ready but activation fails, recheck the current exact-sample
  declaration and every selected panelist's eligibility.
- **Panelist sees no task:** confirm the study is active, the panelist is
  explicitly assigned, the declaration is current and verified, and there is
  no unresolved box issue.
- **QR does not open:** use the fallback code printed on that insert. Do not
  substitute a product ID or a code from another box.
- **Answers saved but box remains open:** locate the pass by fallback code,
  confirm the response exists, resolve any open issue, and retry or complete the
  operational pass update. Do not ask the panelist to submit the answers again.
- **Recovered print batch is missing:** recovery is limited to the same browser
  tab session. Regenerate the batch only after confirming the original inserts
  will not be used, then void superseded passes.
