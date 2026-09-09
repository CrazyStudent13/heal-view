import crypto from 'node:crypto';
import { config } from '../config/index.js';
import { databaseService } from './database.js';

const sessions = new Map();

function getSettingsRow() {
  const result = databaseService.query(
    'SELECT enabled, password_hash, updated_at FROM access_settings WHERE id = 1'
  );
  return result.length > 0 ? result[0].values[0] : [0, null, 0];
}

function ensureSettingsRow() {
  const [, passwordHash] = getSettingsRow();
  if (passwordHash !== null) return;
  databaseService.getDb().run(
    'INSERT OR IGNORE INTO access_settings (id, enabled, password_hash, updated_at) VALUES (1, 0, NULL, ?)',
    [Date.now()]
  );
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

function verifyPassword(password, encodedHash) {
  const [, salt, expectedHex] = String(encodedHash || '').split('$');
  if (!salt || !expectedHex) return false;

  try {
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function readCookies(header = '') {
  return header.split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return cookies;
    const key = part.slice(0, separator).trim();
    const value = decodeURIComponent(part.slice(separator + 1).trim());
    cookies[key] = value;
    return cookies;
  }, {});
}

export function getAccessSettings() {
  ensureSettingsRow();
  const [enabled, passwordHash, updatedAt] = getSettingsRow();
  return {
    enabled: Boolean(enabled),
    configured: Boolean(passwordHash),
    updatedAt: updatedAt || null
  };
}

export function updateAccessSettings({ enabled, password }) {
  ensureSettingsRow();
  const current = getAccessSettings();
  const nextEnabled = Boolean(enabled);
  let passwordHash = null;

  if (password) {
    passwordHash = hashPassword(password);
  } else {
    const [, currentHash] = getSettingsRow();
    passwordHash = currentHash;
  }

  if (nextEnabled && !passwordHash) {
    const error = new Error('开启访问保护前请先设置密码');
    error.code = 'AUTH_PASSWORD_REQUIRED';
    error.status = 400;
    throw error;
  }

  databaseService.getDb().run(
    'UPDATE access_settings SET enabled = ?, password_hash = ?, updated_at = ? WHERE id = 1',
    [nextEnabled ? 1 : 0, passwordHash, Date.now()]
  );

  if (!nextEnabled) sessions.clear();
  return getAccessSettings();
}

export function authenticate(password) {
  const [, passwordHash] = getSettingsRow();
  if (!passwordHash || !verifyPassword(password, passwordHash)) return false;
  return true;
}

export function createSession() {
  cleanupSessions();
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + config.auth.sessionTtl * 1000 });
  return token;
}

export function destroySession(token) {
  if (token) sessions.delete(token);
}

export function isSessionValid(token) {
  cleanupSessions();
  const session = sessions.get(token);
  return Boolean(session && session.expiresAt > Date.now());
}

export function isRequestAuthenticated(req) {
  return isSessionValid(readCookies(req.headers.cookie || '')[config.auth.cookieName]);
}

export function getSessionToken(req) {
  return readCookies(req.headers.cookie || '')[config.auth.cookieName] || '';
}

export function sessionCookie(token) {
  const parts = [
    `${config.auth.cookieName}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${config.auth.sessionTtl}`,
    'SameSite=Lax'
  ];
  if (config.auth.cookieSecure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie() {
  return `${config.auth.cookieName}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}
