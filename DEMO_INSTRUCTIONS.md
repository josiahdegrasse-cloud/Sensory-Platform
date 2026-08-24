# Sensory Platform demo guide

The public demo follows one synthetic food product from instrumental evidence to
a commercialization recommendation. It contains no client, employee, or real
panelist data.

[Open Sensory Platform](https://sensory-platform.vercel.app)

## Demo accounts

Enter either account manually on the sign-in page:

| Account | Email | Password |
| --- | --- | --- |
| Administrator | `admin@sensorydemo.test` | `eOKS3x3o1_r7nI1oi2aP6Z_q` |
| Panelist | `panelist@sensorydemo.test` | `EwDDy-TB1DBpFTtAee_1pIZ3` |

These credentials provide access only to the isolated synthetic demo workspace.
Never reuse them for another account.

## Prepared journey

| Stage | Demo content |
| --- | --- |
| Project | **Plant-Based Cheddar Optimisation** |
| Data | Three instrumental prototypes: `DEMO-S1`, `DEMO-S2`, and `DEMO-S3` |
| Studies | Prepared tasting tasks and synthetic response evidence |
| Decision | Confirmed **GO** for `DEMO-S2` / **Coconut Cheddar v2 — Creamier** |
| Concept | **Everyday Melt Cheddar**, with a prepared image and 11 of 12 responses |
| Report | **Everyday Melt Cheddar concept report**, version 1, in review |

The final concept response is intentionally left open for the demo panelist.

## Administrator walkthrough

Allow about 7 minutes.

1. Sign in as the administrator and open **Plant-Based Cheddar Optimisation**.
   Use the project overview to introduce the connected workflow.
2. Open **Data** and follow `DEMO-S2`. Show how imported measurements retain
   their project, batch, sample, and validation identity.
3. Open **Studies** and review the questionnaire, sample-safety checks,
   assignments, and explicit launch boundary.
4. Open **Insights** and compare the synthetic sensory and instrumental results.
   Note the sample sizes and evidence labels.
5. Open **Decision** and select **Coconut Cheddar v2 — Creamier**. Review its
   confirmed GO result, score, confidence, rationale, and linked evidence.
6. Open **Concept → Tests** and select **Everyday Melt Cheddar**. Review the
   prepared concept stimulus and response summary.
7. Open **Report** and select **Everyday Melt Cheddar concept report**. Review
   the recommendation, evidence lineage, concept findings, actions, limitations,
   and demonstration-only release status.

## Panelist walkthrough

Allow about 2 minutes.

1. Sign out and sign in with the panelist account.
2. Open **Everyday Melt Cheddar** under **Marketing Evaluations**.
3. Review the prepared concept image, price, and five-question survey.
4. Return to the task list without submitting the final response.

The tasting task can also be opened to show blinded sample cues and the sensory
questionnaire flow.

## Demo safeguards

- The workspace contains synthetic data and is isolated by organization and
  role through Supabase Row Level Security.
- New image generation, hosted report AI, invitations, assignment emails,
  Google Drive sync, and instrument imports are disabled server-side.
- Existing concept images and the prepared report remain available.
- Demonstration evidence cannot be approved for client release.

## Keep the demo reusable

The demo uses the live data layer. Avoid actions that change its prepared state,
including submitting the final concept response, changing studies or settings,
creating another concept or report version, or changing the report review state.

Navigation, filtering, opening records, viewing report pages, and inspecting
survey questions are safe.
