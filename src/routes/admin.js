const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { videoQueue } = require('../queues');

router.use(authenticate, authorizeAdmin);

// GET /api/admin/videos - List all videos with metadata
router.get('/videos', async (req, res) => {
  try {
    const videos = await prisma.video.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { comments: true, reactions: true } } }
    });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const fs = require('fs');
const path = require('path');
const { getUploadDir } = require('../config');

// PATCH /api/admin/videos/:id - Update status/pinning/metadata
router.patch('/videos/:id', async (req, res) => {
  const { status, isFeatured, title, description, tags } = req.body;
  try {
    const updated = await prisma.video.update({
      where: { id: req.params.id },
      data: { status, isFeatured, title, description, tags }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/videos/:id - Permanent deletion
router.delete('/videos/:id', async (req, res) => {
  try {
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video) return res.status(404).json({ error: 'Video not found' });

    // 1. Delete HLS files from disk
    const uploadDir = await getUploadDir();
    const videoDir = path.join(uploadDir, video.id);
    if (fs.existsSync(videoDir)) {
      fs.rmSync(videoDir, { recursive: true, force: true });
    }

    // 2. Delete database record (cascades to comments/reactions)
    await prisma.reaction.deleteMany({ where: { videoId: video.id } });
    await prisma.comment.deleteMany({ where: { videoId: video.id } });
    await prisma.video.delete({ where: { id: req.params.id } });

    res.json({ message: 'Video asset purged successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/queue - Monitor job status
router.get('/queue', async (req, res) => {
  try {
    const jobs = await videoQueue.getJobs(['active', 'waiting', 'completed', 'failed']);
    const stats = await videoQueue.getJobCounts();
    res.json({ stats, jobs: jobs.slice(0, 50) }); // Send last 50 jobs
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, isAdmin: true, createdAt: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const bcrypt = require('bcryptjs');

// PATCH /api/admin/users/:id - Update user (isAdmin, username)
router.patch('/users/:id', async (req, res) => {
  const { isAdmin, username } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isAdmin, username }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/users/:id/password - Reset password
router.patch('/users/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hashedPassword }
    });
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/users/:id - Permanent deletion
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Prevent self-deletion
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Delete associated data
    await prisma.reaction.deleteMany({ where: { userId: user.id } });
    await prisma.comment.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: req.params.id } });

    res.json({ message: 'User purged successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/comments - List all comments for scrubbing
router.get('/comments', async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      include: {
        user: { select: { username: true } },
        video: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Categories Management
router.get('/categories', async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  res.json(categories);
});

router.post('/categories', async (req, res) => {
  const { name, tagQuery, order } = req.body;
  const category = await prisma.category.create({
    data: { name, tagQuery, order: order || 0 }
  });
  res.json(category);
});

router.patch('/categories/:id', async (req, res) => {
  const { name, tagQuery, order } = req.body;
  const category = await prisma.category.update({
    where: { id: req.params.id },
    data: { name, tagQuery, order }
  });
  res.json(category);
});

router.delete('/categories/:id', async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ message: 'Category deleted' });
});

module.exports = router;
