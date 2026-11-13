// Usage: npm run create-user -- you@example.com [password]
// Creates (or resets the password of) a confirmed user via the Supabase Admin API.
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY in .env. The secret key never leaves this machine/server.
import { randomInt } from 'node:crypto';

const [email, given] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!email || !url || !secret) {
  console.error('Usage: npm run create-user -- <email> [password]   (SUPABASE_URL and SUPABASE_SECRET_KEY must be set)');
  process.exit(1);
}

const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_';
const generate = (n = 20) => Array.from({ length: n }, () => A[randomInt(A.length)]).join('');
const password = given || generate();
if (password.length < 12) { console.error('Password must be at least 12 characters.'); process.exit(1); }

const headers = { 'content-type': 'application/json', apikey: secret, authorization: `Bearer ${secret}` };
const api = (path, init) => fetch(`${url}/auth/v1/admin${path}`, { ...init, headers });

// Sign-ups are closed by a database trigger: the email must be on the allowlist before a user can exist.
const al = await fetch(`${url}/rest/v1/allowed_emails`, {
  method: 'POST',
  headers: { ...headers, prefer: 'resolution=ignore-duplicates,return=minimal' },
  body: JSON.stringify({ email: email.toLowerCase() }),
});
if (!al.ok) {
  const t = await al.text();
  if (/allowed_emails|PGRST205|42P01/.test(t)) console.warn('Note: allowed_emails table not found. Apply supabase/migrations first to close sign-ups. Continuing.');
  else { console.error('Could not update allowlist:', t); process.exit(1); }
}

let res = await api('/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
let body = await res.json();

if (!res.ok && /already|registered|exists/i.test(JSON.stringify(body))) {
  // Existing user: find them and reset the password instead.
  const list = await (await api('/users?per_page=1000')).json();
  const u = (list.users || []).find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) { console.error('User exists but could not be found.'); process.exit(1); }
  res = await api(`/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ password, email_confirm: true }) });
  body = await res.json();
  if (res.ok) console.log('User already existed, password was reset.');
}
if (!res.ok) { console.error('Failed:', body.msg || body.message || body.error_description || JSON.stringify(body)); process.exit(1); }

console.log(`\nEmail:    ${email}\nPassword: ${password}\nUser id:  ${body.id}\n`);
