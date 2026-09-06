---
name: ci-check
description: >
  Check GitHub Actions CI status for the Park Management repo, report which
  runs are failing, show job-level failures and the first error lines from
  logs, then fix any identified issues.
---

# CI Check Skill

When invoked via `/ci-check`, do the following steps in order. Do NOT skip steps or ask the user to run commands themselves.

## Step 1 — List recent runs

```bash
gh run list --repo D069379/Park_Management --limit 10 --json databaseId,status,conclusion,name,headBranch,event,createdAt \
  | jq '.[] | {id,status,conclusion,name,branch:.headBranch,event,created:.createdAt}'
```

Identify runs that are `failed` or `cancelled`. Focus on the most recent run on `main` or the active feature branch.

## Step 2 — Show job-level status for the failing run

```bash
gh run view <RUN_ID> --repo D069379/Park_Management --json jobs \
  | jq '.jobs[] | {name, conclusion, steps: [.steps[] | select(.conclusion == "failure") | {name, conclusion}]}'
```

## Step 3 — Fetch logs for failing jobs

For each failed job:
```bash
gh run view <RUN_ID> --repo D069379/Park_Management --log-failed 2>&1 | head -200
```

Parse the output to find:
- Which test file + test name failed (look for `FAIL`, `●`, `Error:`, `expect(`)
- Which E2E spec timed out or assertion-errored
- Any schema/seed/worker errors in pre-test steps

## Step 4 — Diagnose and fix

Based on the log output, identify the root cause and apply fixes directly:

### Common failure patterns and fixes

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| `Could not find column 'X'` in E2E | Schema not applied to staging OR production | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `db/schema.sql` |
| `expect(locator).toContainText(...)` mismatch | UI text changed, test not updated | Update the text matcher in the spec file |
| Element not visible: `#cu-name` | Form moved to a different tab panel | Click the correct tab first in the test |
| `net::ERR_CONNECTION_REFUSED` or timeout | Worker cold start | Retry logic in warm-up step; or worker deploy needed |
| `PGRST204` in worker logs | Schema cache not reloaded | Add `NOTIFY pgrst, 'reload schema'` after DDL |
| Seed failure `already registered` | Previous test run left dirty data | Seed teardown needs to delete the record; check `seed.js` |

## Step 5 — Run unit tests locally after any fix

```bash
npm run test:unit
```

All 78 tests must pass before committing.

## Step 6 — Commit and push fixes

```bash
git add <changed files>
git commit -m "fix: <describe what was broken and how>"
git push
```

Then re-check CI within the same session:
```bash
gh run list --repo D069379/Park_Management --limit 5
```

Wait for the new run to complete (poll every 30s up to 5 minutes):
```bash
gh run watch --repo D069379/Park_Management --exit-status
```

## Repo context

- Owner: `D069379`, Repo: `Park_Management`
- Main CI workflow: `.github/workflows/ci.yml`
- E2E spec dir: `tests/e2e/`
- Unit spec dir: `tests/unit/`
- Active branches: `main`, `feat/svelte-migration`
