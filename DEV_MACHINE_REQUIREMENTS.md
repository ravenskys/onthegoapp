# Dev Machine Requirements

This is the software checklist for moving the On The Go Maintenance dev environment to another computer.

## Required Programs

### 1. Visual Studio Code
- Required for editing the project
- Download:
  - `https://code.visualstudio.com/`
- Recommended extensions:
  - Supabase
  - ESLint
  - Tailwind CSS IntelliSense
  - Prettier optional if you use it personally

### 2. Node.js
- Required to run Next.js and install packages
- Download:
  - `https://nodejs.org/`
- Recommended:
  - Node.js 20 LTS or newer
- Verify:
  - `node -v`
  - `npm -v`

### 3. Git
- Required to clone, branch, pull, and push the repo
- Download:
  - `https://git-scm.com/downloads`
- Verify:
  - `git --version`

### 4. Docker Desktop
- Required for local Supabase development
- Download:
  - `https://www.docker.com/products/docker-desktop/`
- Needed for:
  - `supabase start`
  - local database
  - local auth
  - local storage
  - local Supabase Studio
- Verify:
  - `docker version`

### 5. Supabase CLI
- Required to manage migrations and local Supabase workflows
- Docs:
  - `https://supabase.com/docs/guides/cli`
- Dashboard:
  - `https://supabase.com/dashboard`
- On Windows PowerShell in this repo, use:
  - `npx.cmd supabase@latest ...`
- Common commands:
  - `npx.cmd supabase@latest start`
  - `npx.cmd supabase@latest status`
  - `npx.cmd supabase@latest migration list`
  - `npx.cmd supabase@latest db push`

## Accounts / Access Needed

### 1. GitHub access
- Access to the repository
- Access to the correct remotes if pushing from this machine
- GitHub:
  - `https://github.com`

### 2. Supabase access
- Access to the Supabase project dashboard
- Supabase personal access token if using CLI migration commands
- Current linked project ref from handoff:
  - `vzshannrbrcllzzlhfju`
- Supabase:
  - `https://supabase.com/dashboard`

### 3. Vercel access
- Needed only if this machine will handle deployments or env management there
- Vercel dashboard:
  - `https://vercel.com`

## Local Project Files Needed

### 1. Repo contents
- Clone the repo to a local folder

### 2. Environment variables
- Create `.env.local`
- Current app expects:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### 3. Optional user environment variable
- For Supabase CLI work:
  - `SUPABASE_ACCESS_TOKEN`

PowerShell examples:

```powershell
$env:SUPABASE_ACCESS_TOKEN="your_token_here"
[System.Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN","your_token_here","User")
```

## Recommended Setup Order On A New Computer

1. Install Git.
2. Install Node.js LTS.
3. Install Visual Studio Code.
4. Install Docker Desktop.
5. Sign in to GitHub in VS Code if desired.
6. Clone the repo.
7. Create `.env.local`.
8. Run `npm install`.
9. Run `npm run dev`.
10. If using local Supabase, start Docker Desktop and run `npx.cmd supabase@latest start`.

## Quick Verification Checklist

- `git --version`
- `node -v`
- `npm -v`
- `docker version`
- `npm install`
- `npm run dev`
- `npx.cmd supabase@latest start`

## Notes For This Project

- The app can run against hosted Supabase using `.env.local` even if local Docker is not ready yet.
- The VS Code Supabase extension local features require Docker Desktop running.
- The repo contains a `supabase/` directory and migration files, but local Supabase rebuild is currently incomplete because some foundational tables were created manually and are being documented for a future baseline repair.
- See:
  - `LOCAL_SUPABASE_REPAIR_PLAN.md`
  - `MANUAL_CORE_SCHEMA_REFERENCE.md`
