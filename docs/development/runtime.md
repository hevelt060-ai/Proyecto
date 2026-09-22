# Runtime

## Selected version

The project selects Node.js 24 through `.nvmrc`, `package.json` engines and GitHub Actions. Node 24 is the supported LTS target for this repository; Node 26 is not selected merely because it happens to be installed locally.

## Local alignment

Node `24.21.0` is installed through Homebrew at `/opt/homebrew/opt/node@24/bin`. Validation was executed with that path first in `PATH`, producing Node 24 and npm `11.19.0`, matching the project target and CI major version.

Before release, verify:

```bash
node --version
npm --version
npm ci
npm run validate
```

The expected Node major is 24. Do not change the project target to 26 without an explicit compatibility decision and CI update.
