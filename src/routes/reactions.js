const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { authenticate } = require('../middleware/auth');

// POST /api/reactions/:videoId
router.post('/:videoId', authenticate, async (req, res) => {
  const { emoji } = req.body;
  const { videoId } = req.params;
  const userId = req.user.id;

  if (!['👏', '🔥', '🎥', '💯'].includes(emoji)) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }

  try {
    const existing = await prisma.reaction.findUnique({
      where: {
        userId_videoId_emoji: { userId, videoId, emoji }
      }
    });

    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      return res.json({ message: 'Reaction removed' });
    }

    const reaction = await prisma.reaction.create({
      data: { emoji, userId, videoId }
    });
    res.status(201).json(reaction);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
