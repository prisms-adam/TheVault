const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const prisma = require('../src/db');
const reactionRoutes = require('../src/routes/reactions');
const commentRoutes = require('../src/routes/comments');
const authRoutes = require('../src/routes/auth');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/reactions', reactionRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/auth', authRoutes);

describe('Engagement TDD', () => {
  let token;
  let videoId;

  beforeAll(async () => {
    await prisma.reaction.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.video.deleteMany();
    await prisma.user.deleteMany();

    await request(app).post('/api/auth/register').send({ username: 'user', password: 'password' });
    const loginRes = await request(app).post('/api/auth/login').send({ username: 'user', password: 'password' });
    token = loginRes.body.token;

    const video = await prisma.video.create({ data: { title: 'Engage Me', status: 'PUBLIC' } });
    videoId = video.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should add a reaction', async () => {
    const res = await request(app)
      .post(`/api/reactions/${videoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '🔥' });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.emoji).toBe('🔥');
  });

  it('should remove a reaction on second post', async () => {
    const res = await request(app)
      .post(`/api/reactions/${videoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '🔥' });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Reaction removed');
  });

  it('should post a comment', async () => {
    const res = await request(app)
      .post(`/api/comments/${videoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Great session!' });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.text).toBe('Great session!');
    expect(res.body.user.username).toBe('user');
  });
});
