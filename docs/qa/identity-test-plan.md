# Identity test plan

## Implemented

- Correct registration and login.
- Incorrect password rejection.
- Session expiration/revocation behavior.
- User/tenant context creation.
- Request ID and consistent API response shape.
- Invalid input rejection.
- Granular permission denial.
- Audit entry for organization creation.
- Failed-login audit without credentials.

## Required before phase approval

- MongoDB repository integration tests against a replica set.
- Disabled-user login test through the API.
- Membership administration and role-change audit tests.
- Rate limiting and security-header tests.
- Password recovery and MFA readiness tests.
- Update/delete tenant-scope tests for every repository method.
