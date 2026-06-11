---
name: architecture-map
description: Explain the architecture and data flow of a feature before editing.
---

# Architecture Map

Use this before changing a major feature.

Do not edit files unless explicitly asked.

Map the feature across:

1. User flow
What does the user click, see, edit, confirm, or export?

2. Frontend
Which React pages/components are involved?
What is state?
What is props?
What is conditional UI?

3. Backend
Which API routes, Supabase Edge Functions, or secure logic are involved?

4. Database
Which records are read or written?
What is source of truth?
What relationships connect the data?

5. AI
Where is AI used?
What context is sent?
What output is expected?
What validates the output?

6. Human review
Where does admin approve/edit?
What cannot go live automatically?

7. Failure states
What happens if data is missing, AI fails, auth fails, or export fails?

8. Risks
What could break if this is changed?

Return:
1. Architecture summary
2. Data flow diagram in text
3. Important files
4. Source-of-truth records
5. Frontend/backend/AI/database responsibilities
6. Recommended implementation plan
