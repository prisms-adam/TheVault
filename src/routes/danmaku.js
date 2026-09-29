const express = require('express');
const { randomUUID } = require('crypto');
const prisma = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const MODES = new Set(['scroll', 'top', 'bottom']);
const SIZES = new Set([18, 24, 32]);
const COLOR_PATTERN = /^#[0-9A-F]{6}$/i;
const COOLDOWN_MS = 2000;

const userSelection = { username: true };

function validateDanmaku(body, duration) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Danmaku request body must be a JSON object' };
  }

  if (typeof body.text !== 'string') {
    return { error: 'Danmaku text is required' };
  }

  const text = body.text.trim();
  if (!text) {
    return { error: 'Danmaku text cannot be empty' };
  }
  if (Array.from(text).length > 80) {
    return { error: 'Danmaku text must be 80 characters or fewer' };
  }

  if (typeof body.time !== 'number' || !Number.isFinite(body.time) || body.time < 0) {
    return { error: 'Danmaku time must be a finite non-negative number' };
  }
  if (body.time > duration) {
    return { error: 'Danmaku time cannot exceed the video duration' };
  }

  const mode = body.mode === undefined ? 'scroll' : body.mode;
  if (!MODES.has(mode)) {
    return { error: 'Danmaku mode must be scroll, top, or bottom' };
  }

  const color = body.color === undefined ? '#FFFFFF' : body.color;
  if (typeof color !== 'string' || !COLOR_PATTERN.test(color)) {
    return { error: 'Danmaku color must use the #RRGGBB format' };
  }

  const size = body.size === undefined ? 24 : body.size;
  if (!SIZES.has(size)) {
    return { error: 'Danmaku size must be 18, 24, or 32' };
  }

  return {
    data: {
      text,
      time: body.time,
      mode,
      color: color.toUpperCase(),
      size,
    },
  };
}

async function findPublicVideo(videoId) {
  return prisma.video.findFirst({
    where: { id: videoId, status: 'PUBLIC' },
    select: { id: true, duration: true },
  });
}

// GET /api/danmaku/:videoId
router.get('/:videoId', async (req, res) => {
  try {
    const video = await findPublicVideo(req.params.videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const danmakus = await prisma.danmaku.findMany({
      where: { videoId: video.id },
      orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
      include: { user: { select: userSelection } },
    });

    res.json(danmakus);
  } catch (error) {
    console.error('Danmaku read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/danmaku/:videoId
router.post('/:videoId', authenticate, async (req, res) => {
  try {
    const video = await findPublicVideo(req.params.videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const validation = validateDanmaku(req.body, video.duration);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const id = randomUUID();
    const createdAt = new Date();
    const cooldownCutoff = new Date(createdAt.getTime() - COOLDOWN_MS);
    const inserted = await prisma.$executeRaw`
      INSERT INTO "Danmaku" ("id", "text", "time", "mode", "color", "size", "createdAt", "userId", "videoId")
      SELECT ${id}, ${validation.data.text}, ${validation.data.time}, ${validation.data.mode}, ${validation.data.color}, ${validation.data.size}, ${createdAt}, ${req.user.id}, ${video.id}
      WHERE NOT EXISTS (
        SELECT 1
        FROM "Danmaku"
        WHERE "userId" = ${req.user.id}
          AND "createdAt" > ${cooldownCutoff}
      )
    `;

    if (inserted === 0) {
      return res.status(429).json({ error: 'Please wait 2 seconds before sending another danmaku' });
    }

    const danmaku = await prisma.danmaku.findUnique({
      where: { id },
      include: { user: { select: userSelection } },
    });

    res.status(201).json(danmaku);
  } catch (error) {
    console.error('Danmaku create error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/danmaku/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const danmaku = await prisma.danmaku.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true },
    });
    if (!danmaku) {
      return res.status(404).json({ error: 'Danmaku not found' });
    }
    if (danmaku.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own danmaku' });
    }

    await prisma.danmaku.delete({ where: { id: danmaku.id } });
    res.json({ message: 'Danmaku deleted' });
  } catch (error) {
    console.error('Danmaku delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
