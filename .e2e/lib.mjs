// Minimal Next.js server-action client + NextAuth credentials login over HTTP.
const BASE = "http://localhost:3131";

export function jar() {
  return new Map();
}
function cookieHeader(j) {
  return [...j.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function absorb(j, res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) j.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}

export async function get(j, path) {
  const res = await fetch(BASE + path, {
    headers: { cookie: cookieHeader(j) },
    redirect: "manual",
  });
  absorb(j, res);
  return { status: res.status, body: await res.text(), location: res.headers.get("location") };
}

export async function login(j, email, password) {
  const csrfRes = await fetch(BASE + "/api/auth/csrf");
  absorb(j, csrfRes);
  const { csrfToken } = await csrfRes.json();

  const res = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(j) },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: BASE + "/" }),
    redirect: "manual",
  });
  absorb(j, res);

  const s = await get(j, "/api/auth/session");
  const session = JSON.parse(s.body || "{}");
  if (!session?.user?.email) throw new Error(`login failed for ${email}`);
  return session.user;
}

/** Invoke a server action. Returns the decoded result payload. */
export async function action(j, pagePath, actionId, args) {
  const res = await fetch(BASE + pagePath, {
    method: "POST",
    headers: {
      cookie: cookieHeader(j),
      "Next-Action": actionId,
      "content-type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify(args),
    redirect: "manual",
  });
  absorb(j, res);
  const text = await res.text();
  return { status: res.status, text, result: decodeFlight(text) };
}

/** Pull the action's return value out of the RSC flight stream. */
function decodeFlight(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^([0-9a-f]+):(.*)$/);
    if (!m) continue;
    try {
      const v = JSON.parse(m[2]);
      if (v && typeof v === "object" && !Array.isArray(v)) out.push(v);
    } catch {}
  }
  // The action result is the object carrying success/error keys.
  return (
    out.find((o) => "success" in o || "error" in o || "errorCode" in o) ?? out[0] ?? null
  );
}

let pass = 0, fail = 0;
export function check(name, cond, detail = "") {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); fail++; }
}
export function summary() {
  console.log(`\n${pass} passed, ${fail} failed`);
  return fail;
}
