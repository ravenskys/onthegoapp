import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load .env.local before running this script."
  );
  process.exit(1);
}

const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "soaringmike@pm.me").trim().toLowerCase();
const firstName = (process.env.BOOTSTRAP_ADMIN_FIRST_NAME || "Mike").trim();
const lastName = (process.env.BOOTSTRAP_ADMIN_LAST_NAME || "Soaring").trim();
const phone = (process.env.BOOTSTRAP_ADMIN_PHONE || "0000000000").trim();
const generatedPassword = crypto.randomBytes(18).toString("base64url");
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() || generatedPassword;
const allRoles = ["customer", "technician", "manager", "admin"];

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const ensureBucket = async (id) => {
  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Could not list storage buckets: ${listError.message}`);
  }

  if (existingBuckets.some((bucket) => bucket.id === id)) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(id, {
    public: false,
    fileSizeLimit: "50MB",
  });

  if (createError) {
    throw new Error(`Could not create storage bucket "${id}": ${createError.message}`);
  }
};

const findUserByEmail = async (targetEmail) => {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error(`Could not list auth users: ${error.message}`);
    }

    const match = data.users.find((user) => (user.email || "").toLowerCase() === targetEmail);
    if (match) {
      return match;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
};

const ensureUser = async () => {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return { user: existingUser, created: false };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (error || !data.user) {
    throw new Error(`Could not create auth user ${email}: ${error?.message || "unknown error"}`);
  }

  return { user: data.user, created: true };
};

const ensureProfileAndRoles = async (userId) => {
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      role: "admin",
      first_name: firstName,
      last_name: lastName,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    throw new Error(`Could not upsert profile: ${profileError.message}`);
  }

  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert(allRoles.map((role) => ({ user_id: userId, role })), {
      onConflict: "user_id,role",
    });

  if (roleError) {
    throw new Error(`Could not upsert user roles: ${roleError.message}`);
  }
};

const ensureCustomer = async (userId) => {
  const { data: existingCustomer, error: customerLookupError } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (customerLookupError) {
    throw new Error(`Could not check customer row: ${customerLookupError.message}`);
  }

  if (existingCustomer) {
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
      })
      .eq("id", existingCustomer.id);

    if (updateError) {
      throw new Error(`Could not update customer row: ${updateError.message}`);
    }

    return;
  }

  const { error: insertError } = await supabase.from("customers").insert({
    auth_user_id: userId,
    email,
    first_name: firstName,
    last_name: lastName,
    phone,
  });

  if (insertError) {
    throw new Error(`Could not insert customer row: ${insertError.message}`);
  }
};

try {
  await ensureBucket("inspection-photos");
  await ensureBucket("inspection-reports");

  const { user, created } = await ensureUser();
  await ensureProfileAndRoles(user.id);
  await ensureCustomer(user.id);

  console.log(`Bootstrap complete for ${email}`);
  console.log(`Auth user id: ${user.id}`);
  console.log(`Roles: ${allRoles.join(", ")}`);

  if (created && !process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    console.log(`Temporary password: ${password}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
