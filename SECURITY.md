# Security policy

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue. Report them
privately to the repository owner, preferably through GitHub's private security
advisory flow when it is available. Include the affected surface, reproduction
steps, impact, and any suggested mitigation. Do not include real client,
panelist, or credential data in a report.

You should receive an acknowledgement within five working days. Valid reports
will be triaged for severity, tenant-isolation impact, and safe remediation
before disclosure.

## Security boundaries

- Supabase Row Level Security is the primary tenant and role authorization gate.
- Service credentials and model-provider keys belong only in server-side
  environments; browser configuration contains public identifiers only.
- Database types are generated from the linked live schema and checked in CI.
- Report prose is bounded by verified evidence contracts and deterministic QC.
- Production dependencies are audited in CI and monitored by Dependabot.
- Personal, client, and production credentials must never be used for demos or
  automated checks. The intentionally public accounts in
  [DEMO_INSTRUCTIONS.md](DEMO_INSTRUCTIONS.md) can access only the isolated
  synthetic demo tenant.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the schema and deployment controls.
