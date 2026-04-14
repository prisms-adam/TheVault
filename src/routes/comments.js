const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

// POST /api/comments/:videoId
router.post('/:videoId', authenticate, async (req, res) => {
  const { text } = req.body;
  const { videoId } = req.params;
  const userId = req.user.id;

  try {
    const comment = await prisma.comment.create({
      data: { text, userId, videoId },
      include: { user: { select: { username: true } } }
    });
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/comments/:id (Admin or Owner)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (comment.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.comment.delete({ where: { id: req.params.id } });
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/comments/:id/pin (Admin only)
router.patch('/:id/pin', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const updated = await prisma.comment.update({
      where: { id: req.params.id },
      data: { isPinned: !comment.isPinned }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
