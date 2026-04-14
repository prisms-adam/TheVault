const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const prisma = require('../src/db');
const adminRoutes = require('../src/routes/admin');
const authRoutes = require('../src/routes/auth');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);

describe('Admin Logic TDD', () => {
  let adminToken;
  let studentToken;
  let videoId;

  beforeAll(async () => {
    // Clear and Setup
    await prisma.reaction.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.video.deleteMany();
    await prisma.user.deleteMany();

    // Register Admin
    await request(app).post('/api/auth/register').send({ username: 'admin', password: 'password' });
    const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'password' });
    adminToken = loginRes.body.token;

    // Register Student
    await request(app).post('/api/auth/register').send({ username: 'student', password: 'password' });
    const sLoginRes = await request(app).post('/api/auth/login').send({ username: 'student', password: 'password' });
    studentToken = sLoginRes.body.token;

    // Create a Dummy Video
    const video = await prisma.video.create({
      data: { title: 'Test Video', status: 'PUBLIC' }
    });
    videoId = video.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should allow admin to list all videos', async () => {
    const res = await request(app)
      .get('/api/admin/videos')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should deny student from listing admin videos', async () => {
    const res = await request(app)
      .get('/api/admin/videos')
      .set('Authorization', `Bearer ${studentToken}`);
    
    expect(res.statusCode).toBe(403);
  });

  it('should allow admin to pin a video', async () => {
    const res = await request(app)
      .patch(`/api/admin/videos/${videoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isFeatured: true });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.isFeatured).toBe(true);
  });

  it('should allow admin to toggle user role', async () => {
    const student = await prisma.user.findUnique({ where: { username: 'student' } });
    const res = await request(app)
      .patch(`/api/admin/users/${student.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isAdmin: true });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.isAdmin).toBe(true);
  });
});
