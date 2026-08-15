# StackOperator

CI decision engine for GitHub native stacked pull requests (`gh stack`). StackOperator watches a stack, classifies each layer from changed paths, and **cancels** controlled GitHub Actions runs that cannot affect merge — including cascading cancellation when an upstream layer fails.

MVP assumptions (will not silently change):

1. First provider is the **GitHub native Stacks API**, not Graphite/Aviator heuristics.
2. `SKIP` is executed as an **early cancel** of a controlled workflow. A GitHub App cannot prevent Actions from being scheduled.
3. Customers do **not** need to add a custom workflow file.
4. Diffs are **not** persisted — only paths and status.
5. Local runtime is **Docker Compose**, not Vercel serverless.

If classification is unknown, a workflow is not in the controlled set, mapping is missing, or GitHub data is incomplete, StackOperator **runs** (does nothing). It never defaults to skip.

## Architecture

Modular monolith: Next.js web app (dashboard + webhook ACK) and a background worker sharing PostgreSQL and domain packages.

```text
apps/web            Next.js App Router — dashboard, OAuth, webhook ACK
apps/worker         Background processor (same DB, same packages)
packages/github     Octokit, webhook verification, Stacks/PR/Actions APIs
packages/stack-core Normalized Stack/Layer types + graph helpers
packages/config     .stackoperator.yml parse/validate
packages/decision-engine  Pure CIDecision logic (no Octokit, no UI)
packages/database   Prisma schema + client + job queue
packages/shared     Logging, IDs, money/time types, error types
```

Webhook handlers only verify, persist, enqueue, and return `200`. The worker owns GitHub API work.

## GitHub App permissions (least privilege)

| Permission    | Access     | Why                                              |
| ------------- | ---------- | ------------------------------------------------ |
| Metadata      | read       | Always required                                  |
| Pull requests | read       | PRs, files list, `pull_request` including `stacked` |
| Contents      | read       | `.stackoperator.yml` at the stack base           |
| Actions       | read/write | List runs; `POST .../actions/runs/{id}/cancel`   |
| Checks        | write      | StackOperator check run on the layer head SHA    |

The App does **not** request Administration, Workflows write, or Contents write.

## Local setup

### 1. Install dependencies

Requires Node 22+ and [pnpm](https://pnpm.io/) 10 (via `corepack pnpm` if `pnpm` is not on your PATH).

```bash
corepack enable
pnpm install
cp .env.example .env
```

### 2. Start PostgreSQL

```bash
docker compose up -d postgres
pnpm db:migrate
```

### 3. Create the GitHub App from the manifest

1. Go to `https://github.com/settings/apps/new` (user) or `https://github.com/organizations/YOUR_ORG/settings/apps/new`.
2. Paste `app-manifest.json` via the [manifest flow](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest), **or** create the App manually using the permissions and events in that file.
3. Generate a private key. Put the PEM in `GITHUB_APP_PRIVATE_KEY` (you may encode newlines as `\n`).
4. Copy App ID, client ID, client secret, and webhook secret into `.env`.
5. Set the webhook URL to your public tunnel (see below). The local route is `/api/webhooks/github`.
6. Install the App on a repository that has stacked PRs enabled.

Do not commit the PEM, webhook secret, or client secret.

### 4. Expose webhooks

GitHub cannot reach `localhost`. Use [smee](https://smee.io/) or ngrok:

```bash
npx smee-client --url https://smee.io/YOUR_CHANNEL --target http://localhost:3000/api/webhooks/github
```

Point the GitHub App webhook URL at the smee channel (or ngrok URL + `/api/webhooks/github`).

### 5. Run web + worker

```bash
pnpm dev
```

- Dashboard: http://localhost:3000
- Webhook: `POST /api/webhooks/github`

With `DASHBOARD_OPEN_ACCESS=true` (the `.env.example` default), the dashboard lists every installation stored from webhooks — convenient locally, **not** for a shared deployment. Set it to `false` and fill in `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` to require GitHub OAuth. Users then only see installations they can access.

### 6. Full Compose (optional)

```bash
docker compose up --build
```

`web` and `worker` expect a populated `.env` (App credentials). Postgres is included.

## Config (`.stackoperator.yml`)

Place this at the repository root. StackOperator reads it from the **stack base ref** (`contents:read`).

```yaml
version: 1
rules:
  frontend:
    paths: ["src/components/**", "src/styles/**"]
    tests: [unit, frontend-e2e]
  backend:
    paths: ["api/**", "server/**"]
    tests: [unit, integration]
  database:
    paths: ["database/**", "migrations/**"]
    tests: [unit, integration, migration]
workflows:
  integration:
    files: [".github/workflows/ci.yml"]
    names: ["Integration Tests"]
    estimated_minutes: 25
    cascade_on_failure: true
```

- Unmatched paths, empty diffs that match no rule, or incomplete data → **RUN**.
- Mixed classes take the **union** of required tests.
- If a workflow maps to multiple test keys and any of them are required, the whole workflow **RUN**s (job-level skip is not available).
- If this file is omitted, only `pull_request`-triggered workflows on stacked PRs are treated as controlled. Any such failure **cascades** — that is the documented demo default.

## Cancellation eligibility

A run is cancelled only if **all** of the following are true:

1. Event is `pull_request` (never `schedule`, `workflow_dispatch`, `release`, `push`, or `pull_request_target`).
2. It maps to the classified layer (skip) or a descendant of a failed layer (cascade).
3. It is in the config controlled set; if config is absent, only `pull_request` workflows on stacked PRs are controlled.
4. Status is `requested`, `queued`, `waiting`, `pending`, or `in_progress`.
5. There is no existing terminal decision for that `githubRunId`.

Blocking failure: `completed` with `failure` or `timed_out`, and `cascade_on_failure: true` (or the no-config default above). The worker re-fetches the run before cascading because `conclusion` may be null on the webhook.

Dashboard savings figures are **estimated** (config `estimated_minutes`, else in-repo historical average, else a conservative default), using GitHub-hosted Linux 2-core list price. They are never labeled “saved”.

## Scripts

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Out of MVP

AI rules, Graphite/Aviator providers, Slack, SSO, billing, virtual merge simulation, persisting diffs, job-level (intra-workflow) cancellation, and requiring a customer-side GitHub Action.
