# Centralized Dev Setup

## Goal

Keep the full development setup organized so you can move between computers without guessing where anything lives.

## Recommended Single Source Of Truth

Use these systems as the central locations:

### 1. GitHub = source of truth for code and docs
- Store:
  - app code
  - Supabase migrations
  - setup docs
  - handoff docs
  - machine requirements
  - schema recovery docs
- This repo should contain:
  - `README.md`
  - `SESSION_HANDOFF.md`
  - `IMPLEMENTATION_HANDOFF.md`
  - `DEV_MACHINE_REQUIREMENTS.md`
  - `LOCAL_SUPABASE_REPAIR_PLAN.md`
  - `MANUAL_CORE_SCHEMA_REFERENCE.md`
  - `BASELINE_MIGRATION_PLAN.md`
  - this file

### 2. Vercel = source of truth for app deployment environment variables
- Store:
  - production environment variables
  - preview environment variables
  - deployment settings
- Dashboard:
  - `https://vercel.com`

### 3. Supabase = source of truth for database, auth, and storage
- Store:
  - hosted database
  - auth settings
  - storage buckets
  - SQL editor history
  - project settings
- Dashboard:
  - `https://supabase.com/dashboard`

### 4. Password manager or secure vault = source of truth for secrets you need on a machine
- Store:
  - Supabase personal access token
  - database password
  - service role key backup
  - any API keys not meant to live only in Vercel

Recommended tools:
- 1Password
- Bitwarden
- LastPass if already in use
- secure company vault if you have one

## What Should Be In GitHub

Put these in the repo so every computer gets them automatically:

- code
- migrations
- setup instructions
- onboarding docs
- route and permissions docs
- local environment template
- schema recovery references

Recommended additions:
- `.env.example`
- `README.md` setup section

## What Should Not Be In GitHub

Do not commit:

- `.env.local`
- Supabase personal access token
- Supabase database password
- service role secrets unless intentionally stored in a secure private system outside the repo

## Best Cross-Computer Workflow

When moving to a new computer:

1. Install the required programs from `DEV_MACHINE_REQUIREMENTS.md`
2. Clone the GitHub repo
3. Copy secrets from your secure vault
4. Create `.env.local`
5. Confirm Vercel and Supabase dashboard access
6. Run `npm install`
7. Run `npm run dev`

## Strong Recommendation

Add an `.env.example` file to the repo with placeholder keys only.

That gives every machine a central reference for required env vars without exposing secrets.

Recommended contents:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD=
```

## Best Place For "Everything Central"

If you want one practical home base, use this combination:

- GitHub repo for code and documentation
- Supabase dashboard for database and auth
- Vercel dashboard for deployment and envs
- password manager for secrets

That is the cleanest setup across multiple computers because:

- code stays versioned
- secrets stay secure
- infra settings stay accessible
- setup docs travel with the project

## Suggested Repo Standard

Use this repo as the central operating manual.

Recommended core docs:

- `README.md`
- `SESSION_HANDOFF.md`
- `IMPLEMENTATION_HANDOFF.md`
- `DEV_MACHINE_REQUIREMENTS.md`
- `LOCAL_SUPABASE_REPAIR_PLAN.md`
- `MANUAL_CORE_SCHEMA_REFERENCE.md`
- `BASELINE_MIGRATION_PLAN.md`
- `CENTRALIZED_DEV_SETUP.md`

## Current Reality

Hosted Supabase is the active development path right now.

Local Supabase repair is still a separate follow-up task because some foundational tables were created manually outside the tracked migration chain. Use:

- `LOCAL_SUPABASE_REPAIR_PLAN.md`
- `MANUAL_CORE_SCHEMA_REFERENCE.md`
- `BASELINE_MIGRATION_PLAN.md`

for that work.

## Next Improvement

The most useful next repo changes would be:

1. add `.env.example`
2. keep `README.md` aligned with the handoff and setup docs
3. keep all machine, schema, and handoff docs committed in GitHub

That will make switching computers much smoother.
