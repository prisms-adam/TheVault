require('dotenv').config();

if (process.env.NODE_ENV !== 'test' || !/^file:.*test/i.test(process.env.DATABASE_URL || '') || /dev\.db(?:$|\?)/i.test(process.env.DATABASE_URL || '')) {
  throw new Error('Google auth tests require a separate SQLite test database');
}

jest.mock('../src/queues', () => ({ videoQueue: {}, connection: {} }));

const { generateKeyPairSync, randomUUID, createHash } = require('crypto');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../src/db');
const authRoutes = require('../src/routes/auth');
const adminRoutes = require('../src/routes/admin');
const commentsRoutes = require('../src/routes/comments');
const danmakuRoutes = require('../src/routes/danmaku');
const videoRoutes = require('../src/routes/videos');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/vault/api/auth', authRoutes);
app.use('/vault/api/admin', adminRoutes);
app.use('/vault/api/comments', commentsRoutes);
app.use('/vault/api/danmaku', danmakuRoutes);
app.use('/vault/api/videos', videoRoutes);

const prefix = '/vault/api/auth';
const redirectUri = 'http://127.0.0.1:3000/vault/api/auth/google/callback';
const envKeys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'ALLOW_LOCAL_AUTH', 'JWT_SECRET'];
const oldEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const oldFetch = global.fetch;
const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKey = { ...keyPair.publicKey.export({ format: 'jwk' }), kid: 'test-google-key', alg: 'RS256', use: 'sig' };
const runId = randomUUID();
const createdUserIds = new Set();
let video;
let claims;
let signingKey;
let signingKid;
let challenge;
let fetchMock;

function appToken(user) {
  return jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function startLogin(overrides = {}) {
  const result = await request(app).get(`${prefix}/google`);
  expect(result.status).toBe(302);
  const target = new URL(result.headers.location);
  const stateCookie = result.headers['set-cookie'].find(cookie => cookie.startsWith('vault_google_state='));
  expect(stateCookie).toBeDefined();
  challenge = target.searchParams.get('code_challenge');
  claims = {
    iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000),
    sub: `test-${randomUUID()}`, nonce: target.searchParams.get('nonce'),
    hd: 'prismsus.org', email_verified: true,
    email: `student-${randomUUID()}@prismsus.org`, name: 'School Student',
    ...overrides,
  };
  return { result, target, state: target.searchParams.get('state'), cookie: stateCookie.split(';')[0] };
}

async function finishLogin(start, query = {}) {
  const result = await request(app).get(`${prefix}/google/callback`)
    .set('Cookie', start.cookie).query({ state: start.state, code: 'test-authorization-code', ...query });
  const user = claims?.sub ? await prisma.user.findUnique({ where: { googleSub: claims.sub } }) : null;
  if (user) createdUserIds.add(user.id);
  return { result, user };
}

function expectRejected(result, code) {
  expect(result.status).toBe(302);
  const location = new URL(result.headers.location, 'http://127.0.0.1:3000');
  expect(location.pathname).toBe('/vault/login');
  if (code) expect(location.searchParams.get('error')).toBe(code);
  else expect(location.searchParams.get('error')).toBeTruthy();
  expect((result.headers['set-cookie'] || []).some(cookie => /^token=[^;]/.test(cookie))).toBe(false);
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'isolated-google-auth-test-secret';
  video = await prisma.video.create({ data: { title: `SSO test ${runId}`, status: 'PUBLIC', duration: 20 } });
});

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-server-only-secret';
  process.env.GOOGLE_REDIRECT_URI = redirectUri;
  delete process.env.ALLOW_LOCAL_AUTH;
  signingKey = keyPair.privateKey;
  signingKid = publicKey.kid;
  fetchMock = jest.fn(async (url, options) => {
    if (String(url) === 'https://oauth2.googleapis.com/token') {
      const body = new URLSearchParams(options.body);
      expect(body.get('client_secret')).toBe('test-server-only-secret');
      expect(body.get('redirect_uri')).toBe(redirectUri);
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(createHash('sha256').update(body.get('code_verifier')).digest('base64url')).toBe(challenge);
      return new Response(JSON.stringify({ id_token: jwt.sign(JSON.parse(JSON.stringify(claims)), signingKey, { algorithm: 'RS256', keyid: signingKid }), access_token: 'must-not-be-saved' }), { status: 200 });
    }
    if (String(url) === 'https://www.googleapis.com/oauth2/v3/certs') {
      return new Response(JSON.stringify({ keys: [publicKey] }), { status: 200, headers: { 'Cache-Control': 'public, max-age=3600' } });
    }
    throw new Error(`Unexpected external request in isolated test: ${url}`);
  });
  global.fetch = fetchMock;
});

afterAll(async () => {
  global.fetch = oldFetch;
  for (const key of envKeys) {
    if (oldEnv[key] === undefined) delete process.env[key];
    else process.env[key] = oldEnv[key];
  }
  await prisma.comment.deleteMany({ where: { videoId: video.id } });
  await prisma.video.delete({ where: { id: video.id } });
  await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
  await prisma.$disconnect();
});

test('reports provider availability without exposing OAuth secrets', async () => {
  const enabled = await request(app).get(`${prefix}/providers`);
  expect(enabled.body).toMatchObject({ googleEnabled: true, localAuthEnabled: false, domain: 'prismsus.org' });
  expect(JSON.stringify(enabled.body)).not.toContain('test-server-only-secret');
  delete process.env.GOOGLE_CLIENT_SECRET;
  const missing = await request(app).get(`${prefix}/providers`);
  expect(missing.body).toMatchObject({ googleEnabled: false, localAuthEnabled: false });
  delete process.env.GOOGLE_CLIENT_ID;
  const unconfigured = await request(app).get(`${prefix}/providers`);
  expect(unconfigured.body).toMatchObject({ googleEnabled: false, localAuthEnabled: true });
  const unavailable = await request(app).get(`${prefix}/google`);
  expectRejected(unavailable, 'sso_unavailable');
});

test('starts Google login with state, nonce, school hint and S256 PKCE', async () => {
  const { result, target } = await startLogin();
  expect(target.origin).toBe('https://accounts.google.com');
  expect(target.searchParams.get('response_type')).toBe('code');
  expect(target.searchParams.get('hd')).toBe('prismsus.org');
  expect(target.searchParams.get('scope').split(' ').sort()).toEqual(['email', 'openid', 'profile']);
  expect(target.searchParams.get('redirect_uri')).toBe(redirectUri);
  expect(target.searchParams.get('code_challenge_method')).toBe('S256');
  expect(target.searchParams.get('state').length).toBeGreaterThanOrEqual(32);
  expect(result.headers['set-cookie'].join(';')).toMatch(/HttpOnly/i);
  expect(result.headers['set-cookie'].join(';')).toMatch(/SameSite=Lax/i);
});

test('rejects a callback without the browser state cookie before contacting Google', async () => {
  const start = await startLogin();
  const result = await request(app).get(`${prefix}/google/callback`).query({ state: start.state, code: 'code' });
  expectRejected(result, 'sso_invalid_state');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('rejects a mismatched state and a denied Google login', async () => {
  const start = await startLogin();
  const wrong = await finishLogin(start, { state: 'wrong-state' });
  expectRejected(wrong.result, 'sso_invalid_state');
  const deniedStart = await startLogin();
  const denied = await finishLogin(deniedStart, { error: 'access_denied' });
  expectRejected(denied.result, 'sso_cancelled');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('rejects an expired login transaction before exchanging the code', async () => {
  const start = await startLogin();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000);
  try {
    expectRejected((await finishLogin(start)).result, 'sso_invalid_state');
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    clock.mockRestore();
  }
});

test.each(['http://example.com/vault/api/auth/google/callback', 'http://127.0.0.1:3000/wrong-callback'])('fails closed for invalid callback %s', async redirect => {
  process.env.GOOGLE_REDIRECT_URI = redirect;
  const providers = await request(app).get(`${prefix}/providers`);
  expect(providers.body).toMatchObject({ googleEnabled: false, localAuthEnabled: false });
});

test('accepts a verified school student and prevents callback replay', async () => {
  const start = await startLogin();
  const { result, user } = await finishLogin(start);
  expect(result.headers.location).toBe('/vault/');
  expect(user).toMatchObject({ email: claims.email, displayName: 'School Student', googleSub: claims.sub, isAdmin: false });
  const cookie = result.headers['set-cookie'].find(value => value.startsWith('token='));
  expect(cookie).toMatch(/HttpOnly/i);
  const me = await request(app).get(`${prefix}/me`).set('Cookie', cookie.split(';')[0]);
  expect(me.body.user).toMatchObject({ email: claims.email, displayName: 'School Student', isSchoolAccount: true, isAdmin: false });
  expect(me.body.user).not.toHaveProperty('googleSub');
  expect(me.body.user).not.toHaveProperty('password');
  const beforeReplay = fetchMock.mock.calls.length;
  expectRejected((await finishLogin(start)).result, 'sso_invalid_state');
  expect(fetchMock.mock.calls.length).toBe(beforeReplay);
});

test.each(['adam.kemp@prismsus.org', 'Benjamin.Zhao@PRISMSUS.ORG', 'Annie.ye@prismsus.org'])('grants administrator only after verified login for %s', async email => {
  const { result, user } = await finishLogin(await startLogin({ email }));
  expect(result.headers.location).toBe('/vault/admin');
  expect(user.email).toBe(email.toLowerCase());
  expect(user.isAdmin).toBe(true);
});

test.each([
  ['personal Gmail', { hd: undefined, email: 'outside@gmail.com' }],
  ['other Workspace', { hd: 'example.org', email: 'student@prismsus.org' }],
  ['email suffix attack', { email: 'student@prismsus.org.attacker.example' }],
  ['unverified email', { email_verified: false }],
  ['wrong audience', { aud: 'different-client' }],
  ['wrong issuer', { iss: 'https://attacker.example' }],
  ['expired token', { exp: 1 }],
  ['missing expiry', { exp: undefined }],
  ['wrong nonce', { nonce: 'wrong-nonce' }],
  ['missing subject', { sub: '' }],
])('rejects %s without creating a user', async (_label, overrides) => {
  const before = await prisma.user.count();
  const { result } = await finishLogin(await startLogin(overrides));
  expectRejected(result);
  expect(await prisma.user.count()).toBe(before);
});

test('rejects a signature from an untrusted key', async () => {
  const start = await startLogin();
  signingKey = otherKeyPair.privateKey;
  expectRejected((await finishLogin(start)).result);
});

test('rejects a token with an unknown key ID after refreshing Google keys', async () => {
  const start = await startLogin();
  signingKid = 'unpublished-key';
  expectRejected((await finishLogin(start)).result);
  expect(fetchMock.mock.calls.some(([url]) => String(url) === 'https://www.googleapis.com/oauth2/v3/certs')).toBe(true);
});

test('uses stable Google subject when the name and school email change', async () => {
  const first = await finishLogin(await startLogin());
  const second = await finishLogin(await startLogin({ sub: first.user.googleSub, email: `renamed-${randomUUID()}@prismsus.org`, name: 'Updated School Name' }));
  expect(second.user.id).toBe(first.user.id);
  expect(second.user.displayName).toBe('Updated School Name');
  expect(second.user.email).toBe(claims.email);
});

test('does not link or promote an unverified local account with a matching school username', async () => {
  const email = `unverified-${randomUUID()}@prismsus.org`;
  const legacy = await prisma.user.create({ data: { username: email, password: await bcrypt.hash('legacy-test-password', 4), isAdmin: false } });
  createdUserIds.add(legacy.id);
  const { user } = await finishLogin(await startLogin({ email }));
  expect(user.id).not.toBe(legacy.id);
  expect(await prisma.user.findUnique({ where: { id: legacy.id } })).toMatchObject({ googleSub: null, email: null, isAdmin: false });
});

test('does not merge two different Google subjects claiming the same email', async () => {
  const first = await finishLogin(await startLogin());
  const second = await finishLogin(await startLogin({ email: first.user.email }));
  expectRejected(second.result);
  expect(second.user).toBeNull();
  expect((await prisma.user.findUnique({ where: { id: first.user.id } })).googleSub).toBe(first.user.googleSub);
});

test('disables local login and registration in configured school mode', async () => {
  expect((await request(app).post(`${prefix}/register`).send({ username: 'pretend-school-admin', password: 'password123' })).status).toBe(403);
  expect((await request(app).post(`${prefix}/login`).send({ username: 'anything', password: 'password123' })).status).toBe(403);
});

test('preserves explicitly enabled local login without granting school identity', async () => {
  process.env.ALLOW_LOCAL_AUTH = 'true';
  const legacy = await prisma.user.create({ data: { username: `legacy-${runId}`, password: await bcrypt.hash('legacy-test-password', 4) } });
  createdUserIds.add(legacy.id);
  const login = await request(app).post(`${prefix}/login`).send({ username: legacy.username, password: 'legacy-test-password' });
  expect(login.status).toBe(200);
  expect(login.body.user).toMatchObject({ email: null, isSchoolAccount: false });
  process.env.ALLOW_LOCAL_AUTH = 'false';
  for (const path of [`${prefix}/me`, '/vault/api/admin/users']) {
    const staleSession = await request(app).get(path).set('Authorization', `Bearer ${login.body.token}`);
    expect(staleSession.status).toBe(401);
  }
  const staleWrite = await request(app).post(`/vault/api/comments/${video.id}`).set('Authorization', `Bearer ${login.body.token}`).send({ text: 'Should not be accepted' });
  expect(staleWrite.status).toBe(401);
});

test('only administrators can reach video upload handling', async () => {
  const student = (await finishLogin(await startLogin())).user;
  const admin = await prisma.user.findUnique({ where: { email: 'adam.kemp@prismsus.org' } });
  const denied = await request(app).post('/vault/api/videos/upload').set('Authorization', `Bearer ${appToken(student)}`).send({ title: 'Not permitted' });
  expect(denied.status).toBe(403);
  const permitted = await request(app).post('/vault/api/videos/upload').set('Authorization', `Bearer ${appToken(admin)}`).send({ title: 'No file test' });
  expect(permitted.status).toBe(400);
  expect(permitted.body.error).toMatch(/file/i);
});

test('blocks password login, password reset and identity edits for Google users', async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'adam.kemp@prismsus.org' } });
  const googleUser = (await finishLogin(await startLogin())).user;
  process.env.ALLOW_LOCAL_AUTH = 'true';
  await prisma.user.update({ where: { id: googleUser.id }, data: { password: await bcrypt.hash('known-test-password', 4) } });
  expect((await request(app).post(`${prefix}/login`).send({ username: googleUser.username, password: 'known-test-password' })).status).toBe(401);
  for (const [path, body] of [
    [`/vault/api/admin/users/${googleUser.id}/password`, { password: 'replacement-password' }],
    [`/vault/api/admin/users/${googleUser.id}`, { username: 'Forged Identity' }],
  ]) {
    expect((await request(app).patch(path).set('Authorization', `Bearer ${appToken(admin)}`).send(body)).status).toBe(400);
  }
});

test('comments and danmaku expose the verified author and ignore forged user IDs', async () => {
  const googleUser = (await finishLogin(await startLogin())).user;
  const authorization = `Bearer ${appToken(googleUser)}`;
  const author = { displayName: googleUser.displayName, email: googleUser.email, isSchoolAccount: true };
  const comment = await request(app).post(`/vault/api/comments/${video.id}`).set('Authorization', authorization).send({ text: 'School comment', userId: 'forged-user' });
  const danmaku = await request(app).post(`/vault/api/danmaku/${video.id}`).set('Authorization', authorization).send({ text: 'School danmaku', time: 1, userId: 'forged-user' });
  for (const response of [comment, danmaku]) {
    expect(response.status).toBe(201);
    expect(response.body.userId).toBe(googleUser.id);
    expect(response.body.user).toMatchObject(author);
    expect(response.body.user).not.toHaveProperty('googleSub');
    expect(response.body.user).not.toHaveProperty('password');
  }
  const feed = await request(app).get(`/vault/api/videos/${video.id}`);
  expect(feed.body.comments.find(row => row.id === comment.body.id).user).toMatchObject(author);
  const danmakuFeed = await request(app).get(`/vault/api/danmaku/${video.id}`);
  expect(danmakuFeed.body[0].user).toMatchObject(author);
  const admin = await prisma.user.findUnique({ where: { email: 'adam.kemp@prismsus.org' } });
  const moderation = await request(app).get('/vault/api/admin/comments').set('Authorization', `Bearer ${appToken(admin)}`);
  expect(moderation.body.find(row => row.id === comment.body.id).user).toMatchObject(author);
  const users = await request(app).get('/vault/api/admin/users').set('Authorization', `Bearer ${appToken(admin)}`);
  expect(users.body.find(row => row.id === googleUser.id)).toMatchObject(author);
  expect(users.body.every(row => !('password' in row) && !('googleSub' in row))).toBe(true);
});
