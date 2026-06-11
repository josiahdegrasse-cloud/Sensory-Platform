---
name: tenantization-review
description: Review whether the platform supports multiple companies/tenants instead of being hardcoded to one client.
---

# Tenantization Review

Review the app as a multi-company food innovation platform.

Core question:
Would this work for a second company without rewriting the app?

Check for hardcoded:
- company names
- New Food Innovation copy
- logos
- colors
- report footer text
- panelist intro copy
- report tone
- food categories
- default settings
- Supabase queries without tenant/workspace scope
- Edge Functions that do not scope reads/writes by tenant
- AI prompts that could include the wrong client's data

Separate:

Platform-standard:
- import workflow
- survey generation workflow
- Insights
- GO/TWEAK/STOP logic
- Concept Lab structure
- report structure
- validation rules
- data provenance badges

Tenant-specific:
- company name
- logo
- colors
- report tone
- footer
- default copy
- report branding
- client-specific categories/settings

Return:
1. Hardcoded client assumptions
2. Tenant isolation risks
3. Config fields needed
4. Files/components to change
5. Database or RLS concerns
6. Highest-priority fixes
