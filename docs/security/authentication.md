# Authentication

## Implemented

- User records do not contain passwords.
- Credentials are stored separately as bcrypt hashes.
- Passwords are never returned or written to audit metadata.
- Login creates an opaque random token; only its SHA-256 hash is persisted in the session store.
- Sessions contain expiration and revocation timestamps.
- Logout revokes the current session.
- Disabled users cannot authenticate.
- MFA is not implemented, but sessions and identity boundaries remain separate so MFA can be added before issuing a session.

## Endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`

## Remaining work

Production deployment must provide a secret-managed session secret and a hardened session/token policy. Rate limiting, device tracking, account recovery and MFA are future slices. Failed login audit events intentionally contain no password, token or credential values.
