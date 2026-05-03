# New Supabase Rebuild

This repo is now pointed at the new Supabase project:

- project ref: `nwycfrbbeqmubertudxs`
- URL: `https://nwycfrbbeqmubertudxs.supabase.co`

## What is already prepared

- `package.json` now links Supabase CLI to the new project ref.
- Existing tracked migrations remain the schema source of truth.
- `npm run supabase:bootstrap-user` will:
  - create `soaringmike@pm.me` if it does not exist
  - create or update the profile row
  - assign `customer`, `technician`, `manager`, and `admin`
  - create a linked customer row
  - create the `inspection-photos` and `inspection-reports` storage buckets

## What is still required to apply the schema remotely

Add these values to `.env.local`:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

## Rebuild steps

1. Link the repo to the new project:

```powershell
npm run supabase:link
```

2. Apply the tracked schema:

```powershell
npm run supabase:db-push:all
```

3. Bootstrap the cross-role user and storage buckets:

```powershell
npm run supabase:bootstrap-user
```

## Optional override values

The bootstrap script supports these optional env vars:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_ADMIN_FIRST_NAME`
- `BOOTSTRAP_ADMIN_LAST_NAME`
- `BOOTSTRAP_ADMIN_PHONE`

If `BOOTSTRAP_ADMIN_PASSWORD` is not supplied, the script generates a temporary password and prints it once.
