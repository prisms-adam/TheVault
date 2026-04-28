require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const videoRoutes = require('./routes/videos');
const adminRoutes = require('./routes/admin');
const commentRoutes = require('./routes/comments');
const reactionRoutes = require('./routes/reactions');
const voteRoutes = require('./routes/votes');
const prisma = require('./db');

const { getUploadDir } = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Request Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '5gb' }));
app.use(express.urlencoded({ limit: '5gb', extended: true }));
app.use(cookieParser());

// Routes
app.use('/vault/api/auth', authRoutes);
app.use('/vault/api/videos', videoRoutes);
app.use('/vault/api/admin', adminRoutes);
app.use('/vault/api/comments', commentRoutes);
app.use('/vault/api/reactions', reactionRoutes);
app.use('/vault/api/votes', voteRoutes);

app.get('/vault/api/categories', async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  res.json(categories);
});

// Dynamic static files for uploads - Moved AFTER API routes
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/vault/')) return next();
  
  const uploadDir = await getUploadDir();
  
  // Look for /vault/uploads/ or /vault/[custom_dir]/
  if (req.path.startsWith('/vault/uploads/')) {
    const filePath = req.path.substring(15);
    return res.sendFile(path.resolve(uploadDir, filePath), (err) => {
      if (err) next();
    });
  }

  if (uploadDir !== 'uploads' && req.path.startsWith(`/vault/${uploadDir}/`)) {
    const filePath = req.path.substring(uploadDir.length + 8);
    return res.sendFile(path.resolve(uploadDir, filePath), (err) => {
      if (err) next();
    });
  }
  next();
});

// Serve Frontend in Production
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use('/vault', express.static(frontendDist));

// Fallback for SPA routing under /vault - Using a simple use() to avoid path-to-regexp issues
app.use('/vault', (req, res, next) => {
  // Only serve index.html if it's a GET request and not for an API/Asset
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    return res.sendFile(path.join(frontendDist, 'index.html'));
  }
  next();
});

// Redirect root to /vault
app.get('/', (req, res) => {
  res.redirect('/vault');
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`The Vault Studio Console running on http://0.0.0.0:${PORT}`);
});

// Increase timeout for large file uploads (1 hour)
server.timeout = 3600000;
server.keepAliveTimeout = 3600000;
server.headersTimeout = 3601000;

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR HANDLER]:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});
