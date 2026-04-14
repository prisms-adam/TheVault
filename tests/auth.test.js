const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const prisma = require('../src/db');
const authRoutes = require('../src/routes/auth');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

describe('Authentication TDD', () => {
  beforeAll(async () => {
    // Clear the database before testing
    await prisma.reaction.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.video.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should register the first user as an admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'admin_test',
        password: 'password123'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body.user.isAdmin).toBe(true);
    expect(res.body.user.username).toBe('admin_test');
  });

  it('should register subsequent users as non-admins', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'student_test',
        password: 'password123'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body.user.isAdmin).toBe(false);
  });

  it('should login and return a token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin_test',
        password: 'password123'
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.header['set-cookie']).toBeDefined();
  });

  it('should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin_test',
        password: 'wrongpassword'
      });
    
    expect(res.statusCode).toEqual(401);
  });
});
