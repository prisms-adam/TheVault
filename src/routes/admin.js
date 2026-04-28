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
  const { status, isFeatured, isNew, title, description, tags } = req.body;
  try {
    const updated = await prisma.video.update({
      where: { id: req.params.id },
      data: { status, isFeatured, isNew, title, description, tags }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/videos/:id/retry - Re-queue for transcoding
router.post('/videos/:id/retry', async (req, res) => {
  try {
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (!video.originalPath || !fs.existsSync(video.originalPath)) {
      return res.status(400).json({ error: 'Original source file no longer exists. Recovery impossible.' });
    }

    // Set back to PROCESSING
    await prisma.video.update({
      where: { id: video.id },
      data: { status: 'PROCESSING' }
    });

    // Add to queue
    await videoQueue.add('process-video', {
      videoId: video.id,
      filePath: video.originalPath,
      originalName: video.title,
    });

    res.json({ message: 'Video re-queued for transcoding' });
  } catch (error) {
    console.error('Retry error:', error);
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

// Bug Reports Management
router.get('/bugs', async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status && ['OPEN', 'CLOSED'].includes(status.toUpperCase())) {
      query.status = status.toUpperCase();
    }
    const bugs = await prisma.bugReport.findMany({
      where: query,
      include: { fixedByUser: { select: { username: true } } },
      orderBy: [
        { status: 'asc' }, // OPEN first
        { createdAt: 'desc' }
      ]
    });
    res.json(bugs);
  } catch (error) {
    console.error('Get bugs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/bugs', async (req, res) => {
  const { title, description } = req.body;
  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title is required' });
  }
  try {
    const bug = await prisma.bugReport.create({
      data: { title: title.trim(), description: description?.trim() || null },
      include: { fixedByUser: { select: { username: true } } }
    });
    res.status(201).json(bug);
  } catch (error) {
    console.error('Create bug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/bugs/:id', async (req, res) => {
  const { title, description, status } = req.body;
  try {
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (status !== undefined) {
      const newStatus = status.toUpperCase();
      if (!['OPEN', 'CLOSED'].includes(newStatus)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updateData.status = newStatus;
      // If marking as closed, record who and when
      if (newStatus === 'CLOSED' && req.user?.id) {
        updateData.fixedBy = req.user.id;
        updateData.fixedAt = new Date();
      } else if (newStatus === 'OPEN') {
        // Reopening clears the fixed info
        updateData.fixedBy = null;
        updateData.fixedAt = null;
      }
    }
    const bug = await prisma.bugReport.update({
      where: { id: req.params.id },
      data: updateData,
      include: { fixedByUser: { select: { username: true } } }
    });
    res.json(bug);
  } catch (error) {
    console.error('Update bug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/bugs/:id', async (req, res) => {
  try {
    await prisma.bugReport.delete({ where: { id: req.params.id } });
    res.json({ message: 'Bug report deleted' });
  } catch (error) {
    console.error('Delete bug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
