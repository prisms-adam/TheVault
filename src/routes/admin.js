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

// PATCH /api/admin/videos/:id - Update status/pinning
router.patch('/videos/:id', async (req, res) => {
  const { status, isFeatured } = req.body;
  try {
    const updated = await prisma.video.update({
      where: { id: req.params.id },
      data: { status, isFeatured }
    });
    res.json(updated);
  } catch (error) {
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

// PATCH /api/admin/users/:id - Toggle Admin
router.patch('/users/:id', async (req, res) => {
  const { isAdmin } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isAdmin }
    });
    res.json(user);
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

module.exports = router;
