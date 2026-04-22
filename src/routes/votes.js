const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { authenticate } = require('../middleware/auth');

// POST /api/votes/:videoId
router.post('/:videoId', authenticate, async (req, res) => {
  const { value } = req.body; // 1 or -1
  const { videoId } = req.params;
  const userId = req.user.id;

  if (value !== 1 && value !== -1) {
    return res.status(400).json({ error: 'Value must be 1 or -1' });
  }

  try {
    const existing = await prisma.vote.findUnique({
      where: {
        userId_videoId: { userId, videoId }
      }
    });

    if (existing) {
      if (existing.value === value) {
        // Toggle off
        await prisma.vote.delete({ where: { id: existing.id } });
      } else {
        // Change vote
        await prisma.vote.update({
          where: { id: existing.id },
          data: { value }
        });
      }
    } else {
      await prisma.vote.create({
        data: { value, userId, videoId }
      });
    }

    // Recalculate total likes for this video
    const allVotes = await prisma.vote.findMany({
      where: { videoId }
    });
    
    let likes = allVotes.reduce((acc, v) => acc + v.value, 0);
    if (likes < 0) likes = 0; // Like system should never go negative

    await prisma.video.update({
      where: { id: videoId },
      data: { likes }
    });

    res.json({ likes });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
