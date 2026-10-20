const { createHash, createPublicKey, randomBytes, randomUUID, timingSafeEqual } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { SCHOOL_DOMAIN } = require('./userDto');

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const CALLBACK_PATH = '/vault/api/auth/google/callback';
const STATE_COOKIE = 'vault_google_state';
const TRANSACTION_TTL_MS = 10 * 60 * 1000;
const MAX_TRANSACTIONS = 1000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_JWKS_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_JWKS_TTL_MS = 5 * 60 * 1000;
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const ADMIN_EMAILS = new Set([
  'adam.kemp@prismsus.org',
  'benjamin.zhao@prismsus.org',
  'annie.ye@prismsus.org',
]);

const transactions = new Map();
let jwksCache = { expiresAt: 0, keys: new Map() };

class GoogleOAuthError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'GoogleOAuthError';
    this.code = code;
  }
}

function parseRedirectUri(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.pathname !== CALLBACK_PATH ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function getAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = parseRedirectUri(process.env.GOOGLE_REDIRECT_URI?.trim());
  const googleEnabled = Boolean(clientId && clientSecret && redirectUri);
  const hasGoogleCredentials = Boolean(clientId || clientSecret);
  const localOverride = process.env.ALLOW_LOCAL_AUTH?.trim().toLowerCase();
  const localAuthEnabled = localOverride === 'true'
    ? true
    : localOverride === 'false'
      ? false
      : !hasGoogleCredentials;

  return {
    googleEnabled,
    localAuthEnabled,
    domain: SCHOOL_DOMAIN,
    clientId: googleEnabled ? clientId : null,
    clientSecret: googleEnabled ? clientSecret : null,
    redirectUri: googleEnabled ? redirectUri : null,
  };
}

function cookieIsSecure(config) {
  return process.env.NODE_ENV === 'production' || config.redirectUri?.startsWith('https://');
}

function stateCookieOptions(config) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieIsSecure(config),
    maxAge: TRANSACTION_TTL_MS,
    path: CALLBACK_PATH,
  };
}

function clearGoogleStateCookie(res, config = getAuthConfig()) {
  const { maxAge, ...options } = stateCookieOptions(config);
  res.clearCookie(STATE_COOKIE, options);
}

function pruneTransactions(now = Date.now()) {
  for (const [state, transaction] of transactions) {
    if (transaction.expiresAt <= now) transactions.delete(state);
  }
  while (transactions.size >= MAX_TRANSACTIONS) {
    transactions.delete(transactions.keys().next().value);
  }
}

function base64UrlSha256(value) {
  return createHash('sha256').update(value).digest('base64url');
}

function createAuthorizationRequest(res, config = getAuthConfig()) {
  if (!config.googleEnabled) throw new GoogleOAuthError('sso_unavailable');

  pruneTransactions();
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const verifier = randomBytes(64).toString('base64url');
  transactions.set(state, {
    nonce,
    verifier,
    expiresAt: Date.now() + TRANSACTION_TTL_MS,
  });
  res.cookie(STATE_COOKIE, state, stateCookieOptions(config));

  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: base64UrlSha256(verifier),
    code_challenge_method: 'S256',
    hd: SCHOOL_DOMAIN,
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function consumeAuthorizationResponse(req, res, config = getAuthConfig()) {
  clearGoogleStateCookie(res, config);
  const state = typeof req.query.state === 'string' ? req.query.state : null;
  const cookieState = req.cookies?.[STATE_COOKIE];
  if (!state || !safeEqual(state, cookieState)) {
    throw new GoogleOAuthError('sso_invalid_state');
  }

  const transaction = transactions.get(state);
  transactions.delete(state);
  if (!transaction || transaction.expiresAt <= Date.now()) {
    throw new GoogleOAuthError('sso_invalid_state');
  }
  if (req.query.error) throw new GoogleOAuthError('sso_cancelled');
  if (typeof req.query.code !== 'string' || !req.query.code) {
    throw new GoogleOAuthError('sso_failed');
  }
  return { code: req.query.code, ...transaction };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function exchangeAuthorizationCode(code, verifier, config = getAuthConfig()) {
  if (!config.googleEnabled) throw new GoogleOAuthError('sso_unavailable');
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });
  const response = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new GoogleOAuthError('sso_failed');
  const tokens = await response.json();
  if (typeof tokens.id_token !== 'string') throw new GoogleOAuthError('sso_failed');
  return tokens.id_token;
}

function cacheTtl(response) {
  const cacheControl = response.headers?.get?.('cache-control') || '';
  const match = /(?:^|,)\s*max-age=(\d+)/i.exec(cacheControl);
  const ttl = match ? Number(match[1]) * 1000 : DEFAULT_JWKS_TTL_MS;
  return Math.max(1000, Math.min(Number.isFinite(ttl) ? ttl : DEFAULT_JWKS_TTL_MS, MAX_JWKS_TTL_MS));
}

async function refreshJwks() {
  const response = await fetchWithTimeout(JWKS_URL);
  if (!response.ok) throw new GoogleOAuthError('sso_failed');
  const payload = await response.json();
  if (!Array.isArray(payload.keys)) throw new GoogleOAuthError('sso_failed');
  const keys = new Map();
  for (const jwk of payload.keys) {
    if (jwk?.kid && jwk.kty === 'RSA' && (!jwk.alg || jwk.alg === 'RS256')) {
      keys.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
    }
  }
  if (!keys.size) throw new GoogleOAuthError('sso_failed');
  jwksCache = { keys, expiresAt: Date.now() + cacheTtl(response) };
}

async function getSigningKey(kid) {
  if (Date.now() >= jwksCache.expiresAt) await refreshJwks();
  let key = jwksCache.keys.get(kid);
  if (!key) {
    await refreshJwks();
    key = jwksCache.keys.get(kid);
  }
  if (!key) throw new GoogleOAuthError('sso_failed');
  return key;
}

function normalizeSchoolEmail(value) {
  if (typeof value !== 'string') throw new GoogleOAuthError('sso_domain');
  const email = value.trim().toLowerCase();
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[0] || parts[1] !== SCHOOL_DOMAIN) {
    throw new GoogleOAuthError('sso_domain');
  }
  return email;
}

async function verifyGoogleIdToken(idToken, expectedNonce, config = getAuthConfig()) {
  if (!config.googleEnabled) throw new GoogleOAuthError('sso_unavailable');
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || decoded.header?.alg !== 'RS256' || typeof decoded.header.kid !== 'string') {
    throw new GoogleOAuthError('sso_failed');
  }
  const key = await getSigningKey(decoded.header.kid);
  let claims;
  try {
    claims = jwt.verify(idToken, key, {
      algorithms: ['RS256'],
      audience: config.clientId,
      issuer: GOOGLE_ISSUERS,
    });
  } catch {
    throw new GoogleOAuthError('sso_failed');
  }
  if (
    typeof claims.exp !== 'number' ||
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    !safeEqual(claims.nonce, expectedNonce)
  ) {
    throw new GoogleOAuthError('sso_failed');
  }
  if (claims.email_verified !== true || String(claims.hd).toLowerCase() !== SCHOOL_DOMAIN) {
    throw new GoogleOAuthError('sso_domain');
  }
  return {
    sub: claims.sub,
    email: normalizeSchoolEmail(claims.email),
    displayName: typeof claims.name === 'string' && claims.name.trim()
      ? claims.name.trim().slice(0, 200)
      : normalizeSchoolEmail(claims.email).split('@')[0],
  };
}

async function upsertGoogleUser(identity) {
  const email = normalizeSchoolEmail(identity.email);
  const forceAdmin = ADMIN_EMAILS.has(email);
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { googleSub: identity.sub } });
      const emailOwner = await tx.user.findUnique({ where: { email } });
      if (emailOwner && emailOwner.id !== existing?.id) {
        throw new GoogleOAuthError('sso_failed');
      }
      if (existing) {
        return tx.user.update({
          where: { id: existing.id },
          data: {
            email,
            displayName: identity.displayName,
            ...(forceAdmin ? { isAdmin: true } : {}),
          },
        });
      }

      const id = randomUUID();
      const unusablePassword = await bcrypt.hash(randomBytes(48).toString('base64url'), 12);
      return tx.user.create({
        data: {
          id,
          username: `google_${id}`,
          password: unusablePassword,
          googleSub: identity.sub,
          email,
          displayName: identity.displayName,
          isAdmin: forceAdmin,
        },
      });
    });
  } catch (error) {
    if (error instanceof GoogleOAuthError) throw error;
    throw new GoogleOAuthError('sso_failed');
  }
}

function resetGoogleOAuthStateForTests() {
  transactions.clear();
  jwksCache = { expiresAt: 0, keys: new Map() };
}

module.exports = {
  ADMIN_EMAILS,
  CALLBACK_PATH,
  GoogleOAuthError,
  STATE_COOKIE,
  clearGoogleStateCookie,
  consumeAuthorizationResponse,
  createAuthorizationRequest,
  exchangeAuthorizationCode,
  getAuthConfig,
  resetGoogleOAuthStateForTests,
  upsertGoogleUser,
  verifyGoogleIdToken,
};
