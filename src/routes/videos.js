const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../db');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { videoQueue } = require('../queues');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'temp/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB
  fileFilter: (req, file, cb) => {
    console.log(`[MULTER FILTER] Incoming file: ${file.originalname} (${file.mimetype})`);
    const filetypes = /mp4|mov|mkv|quicktime|video\/mp4|video\/x-matroska|video\/quicktime/;
    const extname = /mp4|mov|mkv/.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype || extname) {
      console.log(`[MULTER FILTER] Accepted: ${file.originalname}`);
      return cb(null, true);
    }
    console.warn(`[MULTER FILTER] Rejected: ${file.originalname} - Mime: ${file.mimetype}`);
    cb(new Error('Only .mp4, .mov, and .mkv files are allowed!'));
  },
});

// POST /api/videos/upload
router.post('/upload', authenticate, (req, res, next) => {
  console.log(`[UPLOAD ROUTE] Starting upload for user: ${req.user.username}`);
  upload.single('video')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error(`[UPLOAD ROUTE] Multer Error: ${err.message}`, err);
      return res.status(400).json({ error: `Multer error: ${err.message}` });
    } else if (err) {
      console.error(`[UPLOAD ROUTE] Error: ${err.message}`);
      return res.status(400).json({ error: err.message });
    }
    console.log(`[UPLOAD ROUTE] File received: ${req.file ? req.file.path : 'None'}`);
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded' });
  }

  try {
    const { title, description } = req.body;
    
    const video = await prisma.video.create({
      data: {
        title: title || req.file.originalname,
        description,
        status: 'PROCESSING',
        originalPath: req.file.path,
      },
    });

    // Add to processing queue
    await videoQueue.add('process-video', {
      videoId: video.id,
      filePath: req.file.path,
      originalName: req.file.originalname,
    });

    res.status(201).json({ 
      message: 'Video uploaded and queued for processing', 
      video 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/videos
router.get('/', async (req, res) => {
  try {
    const videos = await prisma.video.findMany({
      where: { status: 'PUBLIC' },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { reactions: true, comments: true }
        }
      }
    });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/videos/:id
router.get('/:id', async (req, res) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
      include: {
        comments: {
          include: { user: { select: { username: true } } },
          orderBy: { createdAt: 'desc' }
        },
        reactions: true
      }
    });
    
    if (!video || (video.status !== 'PUBLIC' && (!req.user || !req.user.isAdmin))) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
