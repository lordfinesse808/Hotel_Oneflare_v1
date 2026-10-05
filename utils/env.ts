import fs from 'fs';
import path from 'path';

/**
 * Reads the repository .env. Accepts both `KEY=value` and the
 * `Email: x` / `Password: y` format used by the committed file.
 * Real environment variables take precedence.
 */
function loadDotEnv(): Record<string, string> {
  const file = path.resolve(__dirname, '..', '.env');
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][\w ]*?)\s*[:=]\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim().toUpperCase().replace(/\s+/g, '_');
    out[key] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const file = loadDotEnv();
const pick = (...keys: string[]) => {
  for (const k of keys) {
    const v = process.env[k] ?? file[k];
    if (v) return v;
  }
  return '';
};

export const env = {
  baseURL: pick('BASE_URL') || 'https://hotel-plaza-preview.vercel.app',
  email: pick('USER_EMAIL', 'TEST_EMAIL', 'EMAIL'),
  password: pick('USER_PASSWORD', 'TEST_PASSWORD', 'PASSWORD'),
  /** Set CONFIRM_BOOKINGS=1 to let tests click "Confirm booking" and create real reservations. */
  confirmBookings: pick('CONFIRM_BOOKINGS') === '1',
  /** Set EXPECT_KNOWN_BUGS=1 to mark tests linked to open bugs as expected failures. */
  expectKnownBugs: pick('EXPECT_KNOWN_BUGS') === '1',
};

export const hasCredentials = () => !!(env.email && env.password);
