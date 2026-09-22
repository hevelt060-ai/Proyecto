# Dependency audit

Audit date: 2026-09-22.

## Result

`npm audit --omit=optional --audit-level=moderate` reports two moderate vulnerabilities:

- Advisory: `GHSA-82fw-gwwq-j7x9`.
- Affected package: `@vitest/mocker`.
- Dependency path: `vitest@3.2.7` -> `@vitest/mocker`.
- Issue: path traversal/arbitrary file read through redirect mocks.
- npm-reported fix: Vitest `5.0.1`, a major upgrade.

## Decision

Do not run `npm audit fix --force`. The current test suite is green and the suggested fix is a breaking major upgrade. The issue is limited to the test toolchain, not production runtime dependencies, but CI runners must not execute untrusted tests or fixtures without isolation.

## Mitigation

- Keep test execution in controlled CI/workspace environments.
- Do not use redirect mocks with untrusted paths.
- Review Vitest 5 migration notes in a separate dependency change.
- Re-run the complete suite and inspect configuration/API changes before upgrading.

This is a pending dependency risk, not silently accepted as resolved.
