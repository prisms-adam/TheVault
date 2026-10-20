require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL || '';
const isIsolatedTestDatabase = (
  process.env.NODE_ENV === 'test'
  && databaseUrl.startsWith('file:')
  && /test/i.test(databaseUrl)
  && !/dev\.db(?:$|\?)/i.test(databaseUrl)
);

if (!isIsolatedTestDatabase) {
  throw new Error('Danmaku tests require an isolated SQLite test database; refusing to use the application database');
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'danmaku-test-secret';

const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const prisma = require('../src/db');
const danmakuRoutes = require('../src/routes/danmaku');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/danmaku', danmakuRoutes);

const createdUserIds = [];
const createdVideoIds = [];

function tokenFor(user) {
  return jwt.sign(
    { userId: user.id, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function createUser(username, isAdmin = false) {
  const user = await prisma.user.create({
    data: {
      username,
      password: 'not-used-by-danmaku-tests',
      isAdmin,
    },
  });
  createdUserIds.push(user.id);
  return user;
}

async function createVideo(title, status = 'PUBLIC', duration = 120) {
  const video = await prisma.video.create({ data: { title, status, duration } });
  createdVideoIds.push(video.id);
  return video;
}

async function deleteVideoIfPresent(id) {
  const video = await prisma.video.findUnique({ where: { id }, select: { id: true } });
  if (video) await prisma.video.delete({ where: { id } });
}

async function deleteUserIfPresent(id) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (user) await prisma.user.delete({ where: { id } });
}

describe('Danmaku API', () => {
  let owner;
  let other;
  let admin;
  let poster;
  let concurrentPoster;
  let publicVideo;
  let hiddenVideo;
  let earlyDanmaku;
  let lateDanmaku;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    owner = await createUser(`danmaku-owner-${suffix}`);
    other = await createUser(`danmaku-other-${suffix}`);
    admin = await createUser(`danmaku-admin-${suffix}`, true);
    poster = await createUser(`danmaku-poster-${suffix}`);
    concurrentPoster = await createUser(`danmaku-concurrent-poster-${suffix}`);
    publicVideo = await createVideo(`Danmaku public ${suffix}`);
    hiddenVideo = await createVideo(`Danmaku hidden ${suffix}`, 'PROCESSING');

    lateDanmaku = await prisma.danmaku.create({
      data: { text: 'Later', time: 30, userId: owner.id, videoId: publicVideo.id },
    });
    earlyDanmaku = await prisma.danmaku.create({
      data: { text: 'Earlier', time: 5, userId: owner.id, videoId: publicVideo.id },
    });
  });

  afterAll(async () => {
    for (const id of [...createdVideoIds].reverse()) await deleteVideoIfPresent(id);
    for (const id of [...createdUserIds].reverse()) await deleteUserIfPresent(id);
    await prisma.$disconnect();
  });

  test('reads public-video danmaku in timestamp order with a safe user shape', async () => {
    const response = await request(app).get(`/api/danmaku/${publicVideo.id}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.slice(0, 2).map((item) => item.id)).toEqual([
      earlyDanmaku.id,
      lateDanmaku.id,
    ]);
    expect(response.body[0].user).toEqual({ username: owner.username, displayName: null, email: null, isSchoolAccount: false });
    expect(response.body[0].user.password).toBeUndefined();
  });

  test.each([
    ['hidden', () => hiddenVideo.id],
    ['missing', () => 'missing-video-id'],
  ])('does not expose a %s video', async (_label, id) => {
    const response = await request(app).get(`/api/danmaku/${id()}`);
    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('Video not found');
  });

  test('requires login before saving a danmaku', async () => {
    const response = await request(app)
      .post(`/api/danmaku/${publicVideo.id}`)
      .send({ text: 'Login required', time: 10 });

    expect(response.statusCode).toBe(401);
  });

  test('saves a trimmed danmaku with defaults and the authenticated author', async () => {
    const response = await request(app)
      .post(`/api/danmaku/${publicVideo.id}`)
      .set('Authorization', `Bearer ${tokenFor(poster)}`)
      .send({ text: '  Hello from the timeline  ', time: 12.5, userId: other.id });

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({
      text: 'Hello from the timeline',
      time: 12.5,
      mode: 'scroll',
      color: '#FFFFFF',
      size: 24,
      userId: poster.id,
      videoId: publicVideo.id,
      user: { username: poster.username },
    });

    const stored = await prisma.danmaku.findUnique({ where: { id: response.body.id } });
    expect(stored.createdAt).toBeInstanceOf(Date);
    const storage = await prisma.$queryRaw`
      SELECT typeof("createdAt") AS "storageType"
      FROM "Danmaku"
      WHERE "id" = ${response.body.id}
    `;
    expect(storage).toEqual([{ storageType: 'integer' }]);
  });

  test('enforces a two-second per-user cooldown', async () => {
    const response = await request(app)
      .post(`/api/danmaku/${publicVideo.id}`)
      .set('Authorization', `Bearer ${tokenFor(poster)}`)
      .send({ text: 'Too soon', time: 13 });

    expect(response.statusCode).toBe(429);
    expect(response.body.error).toMatch(/wait 2 seconds/i);
  });

  test('applies the cooldown to rows previously created through Prisma', async () => {
    const response = await request(app)
      .post(`/api/danmaku/${publicVideo.id}`)
      .set('Authorization', `Bearer ${tokenFor(owner)}`)
      .send({ text: 'Blocked by an ORM-created row', time: 14 });

    expect(response.statusCode).toBe(429);
  });

  test('atomically accepts only one of several concurrent posts from the same user', async () => {
    const responses = await Promise.all(
      Array.from({ length: 4 }, (_, index) => request(app)
        .post(`/api/danmaku/${publicVideo.id}`)
        .set('Authorization', `Bearer ${tokenFor(concurrentPoster)}`)
        .send({ text: `Concurrent ${index}`, time: 20 + index })),
    );

    expect(responses.filter((response) => response.statusCode === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.statusCode === 429)).toHaveLength(3);

    const stored = await prisma.danmaku.findMany({
      where: { userId: concurrentPoster.id },
    });
    expect(stored).toHaveLength(1);
  });

  test.each([
    [{ text: '   ', time: 1 }, /cannot be empty/i],
    [{ text: 'x'.repeat(81), time: 1 }, /80 characters/i],
    [{ text: 'Bad time', time: -1 }, /non-negative/i],
    [{ text: 'Past end', time: 121 }, /video duration/i],
    [{ text: 'Bad mode', time: 1, mode: 'reverse' }, /mode/i],
    [{ text: 'Bad color', time: 1, color: 'white' }, /#RRGGBB/i],
    [{ text: 'Bad size', time: 1, size: 20 }, /18, 24, or 32/i],
  ])('validates danmaku input %#', async (payload, errorPattern) => {
    const response = await request(app)
      .post(`/api/danmaku/${publicVideo.id}`)
      .set('Authorization', `Bearer ${tokenFor(other)}`)
      .send(payload);

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(errorPattern);
  });

  test('rejects a missing JSON body as a client error', async () => {
    const response = await request(app)
      .post(`/api/danmaku/${publicVideo.id}`)
      .set('Authorization', `Bearer ${tokenFor(other)}`);

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/JSON object/i);
  });

  test('does not allow saving danmaku on a non-public video', async () => {
    const response = await request(app)
      .post(`/api/danmaku/${hiddenVideo.id}`)
      .set('Authorization', `Bearer ${tokenFor(other)}`)
      .send({ text: 'Still processing', time: 1 });

    expect(response.statusCode).toBe(404);
  });

  test('allows only the owner to delete their danmaku', async () => {
    const forbidden = await request(app)
      .delete(`/api/danmaku/${earlyDanmaku.id}`)
      .set('Authorization', `Bearer ${tokenFor(other)}`);
    expect(forbidden.statusCode).toBe(403);

    const deleted = await request(app)
      .delete(`/api/danmaku/${earlyDanmaku.id}`)
      .set('Authorization', `Bearer ${tokenFor(owner)}`);
    expect(deleted.statusCode).toBe(200);

    const missing = await request(app)
      .delete(`/api/danmaku/${earlyDanmaku.id}`)
      .set('Authorization', `Bearer ${tokenFor(owner)}`);
    expect(missing.statusCode).toBe(404);
  });

  test('allows an administrator to delete another user\'s danmaku', async () => {
    const response = await request(app)
      .delete(`/api/danmaku/${lateDanmaku.id}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(response.statusCode).toBe(200);
    expect(await prisma.danmaku.findUnique({ where: { id: lateDanmaku.id } })).toBeNull();
  });

  test('cascades danmaku deletion when its video or author is deleted', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const videoToDelete = await createVideo(`Danmaku cascade video ${suffix}`);
    const videoDanmaku = await prisma.danmaku.create({
      data: { text: 'Delete with video', time: 1, userId: other.id, videoId: videoToDelete.id },
    });
    await prisma.video.delete({ where: { id: videoToDelete.id } });
    expect(await prisma.danmaku.findUnique({ where: { id: videoDanmaku.id } })).toBeNull();

    const userToDelete = await createUser(`danmaku-cascade-user-${suffix}`);
    const userVideo = await createVideo(`Danmaku cascade user video ${suffix}`);
    const userDanmaku = await prisma.danmaku.create({
      data: { text: 'Delete with user', time: 1, userId: userToDelete.id, videoId: userVideo.id },
    });
    await prisma.user.delete({ where: { id: userToDelete.id } });
    expect(await prisma.danmaku.findUnique({ where: { id: userDanmaku.id } })).toBeNull();
  });
});
