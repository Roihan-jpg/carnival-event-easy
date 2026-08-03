const EVENT_ID = "00000000-0000-4000-8000-000000000001";

const accounts = [
  {
    key: "super_admin",
    fullName: "Super Admin Karnaval",
    email: "super-admin@carnival.local",
    role: "super_admin",
  },
  {
    key: "admin",
    fullName: "Admin Panitia Karnaval",
    email: "admin@carnival.local",
    role: "admin",
  },
  {
    key: "judge_start",
    fullName: "Juri Start",
    email: "judge-start@carnival.local",
    role: "judge",
    judgeLocationId: "00000000-0000-4000-8100-000000000001",
  },
  {
    key: "judge_b_edi",
    fullName: "Juri Gedangmas B. Edi",
    email: "judge-b-edi@carnival.local",
    role: "judge",
    judgeLocationId: "00000000-0000-4000-8100-000000000002",
  },
  {
    key: "judge_finish",
    fullName: "Juri Finish",
    email: "judge-finish@carnival.local",
    role: "judge",
    judgeLocationId: "00000000-0000-4000-8100-000000000003",
  },
  {
    key: "verifier_junaidi",
    fullName: "Verifier Atraksi Junaidi",
    email: "verifier-junaidi@carnival.local",
    role: "operator",
    attractionPointId: "00000000-0000-4000-8200-000000000001",
  },
  {
    key: "verifier_b_sul",
    fullName: "Verifier Atraksi B. Sul",
    email: "verifier-b-sul@carnival.local",
    role: "operator",
    attractionPointId: "00000000-0000-4000-8200-000000000002",
  },
  {
    key: "verifier_toko_aminah",
    fullName: "Verifier Atraksi Toko Aminah",
    email: "verifier-toko-aminah@carnival.local",
    role: "operator",
    attractionPointId: "00000000-0000-4000-8200-000000000003",
  },
  {
    key: "operator",
    fullName: "Operator Lapangan Utama",
    email: "operator@carnival.local",
    role: "operator",
  },
];

const isApply = process.argv.includes("--apply");

if (!isApply) {
  console.table(
    accounts.map(
      ({ fullName, email, role, judgeLocationId, attractionPointId }) => ({
        name: fullName,
        email,
        role,
        assignment: judgeLocationId ?? attractionPointId ?? "operasional umum",
      }),
    ),
  );
  console.log(
    "Dry run only. Use --apply with the required environment variables to create users.",
  );
  process.exit(0);
}

const supabaseUrl = requireEnvironment("SUPABASE_URL").replace(/\/$/, "");
const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const demoPassword = requireEnvironment("DEMO_USER_PASSWORD");

if (demoPassword.length < 8) {
  throw new Error("DEMO_USER_PASSWORD must contain at least 8 characters.");
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

const existingUsers = await request("/auth/v1/admin/users?per_page=1000");
const usersByEmail = new Map(
  (existingUsers.users ?? [])
    .filter((user) => user.email)
    .map((user) => [user.email.toLowerCase(), user]),
);
const resolvedAccounts = [];

for (const account of accounts) {
  const emailKey = account.email.toLowerCase();
  let user = usersByEmail.get(emailKey);

  if (!user) {
    user = await request("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: account.email,
        password: demoPassword,
        email_confirm: true,
        user_metadata: { full_name: account.fullName },
      }),
    });
  }

  resolvedAccounts.push({ ...account, id: user.id });
}

await request("/rest/v1/profiles?on_conflict=id", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify(
    resolvedAccounts.map(({ id, fullName, role }) => ({
      id,
      full_name: fullName,
      role,
      is_active: true,
    })),
  ),
});

const superAdminId = resolvedAccounts.find(
  ({ key }) => key === "super_admin",
).id;

await ensureAssignments({
  table: "judge_assignments",
  accountIdColumn: "judge_id",
  targetIdColumn: "location_id",
  targetAccountProperty: "judgeLocationId",
  assignedBy: superAdminId,
  resolvedAccounts,
});

await ensureAssignments({
  table: "attraction_verifier_assignments",
  accountIdColumn: "operator_id",
  targetIdColumn: "attraction_point_id",
  targetAccountProperty: "attractionPointId",
  assignedBy: superAdminId,
  resolvedAccounts,
});

console.log(
  `Created or reconciled ${resolvedAccounts.length} demo accounts without exposing a password.`,
);

async function ensureAssignments({
  table,
  accountIdColumn,
  targetIdColumn,
  targetAccountProperty,
  assignedBy,
  resolvedAccounts: accountList,
}) {
  const expected = accountList.filter(
    (account) => account[targetAccountProperty],
  );
  const existing = await request(
    `/rest/v1/${table}?event_id=eq.${EVENT_ID}&revoked_at=is.null&select=${accountIdColumn},${targetIdColumn}`,
  );

  for (const account of expected) {
    const conflictingAccount = existing.find(
      (assignment) =>
        assignment[accountIdColumn] === account.id &&
        assignment[targetIdColumn] !== account[targetAccountProperty],
    );
    const conflictingTarget = existing.find(
      (assignment) =>
        assignment[targetIdColumn] === account[targetAccountProperty] &&
        assignment[accountIdColumn] !== account.id,
    );

    if (conflictingAccount || conflictingTarget) {
      throw new Error(
        `Active ${table} data conflicts with the requested demo roster.`,
      );
    }

    const alreadyAssigned = existing.some(
      (assignment) =>
        assignment[accountIdColumn] === account.id &&
        assignment[targetIdColumn] === account[targetAccountProperty],
    );

    if (!alreadyAssigned) {
      await request(`/rest/v1/${table}`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          event_id: EVENT_ID,
          [accountIdColumn]: account.id,
          [targetIdColumn]: account[targetAccountProperty],
          assigned_by: assignedBy,
        }),
      });
    }
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `${options.method ?? "GET"} ${path} failed (${response.status}): ${message}`,
    );
  }

  if (response.status === 204) {
    return null;
  }

  const responseText = await response.text();
  return responseText ? JSON.parse(responseText) : null;
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required when using --apply.`);
  }
  return value;
}
