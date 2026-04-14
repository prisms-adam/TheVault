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

const { getUploadDir } = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Dynamic static files for uploads
app.use(async (req, res, next) => {
  if (req.path.startsWith('/uploads/')) {
    const uploadDir = await getUploadDir();
    return express.static(path.resolve(uploadDir))(req, res, next);
  }
  // Allow serving from the actual folder name if it's different from 'uploads'
  const uploadDir = await getUploadDir();
  if (uploadDir !== 'uploads' && req.path.startsWith(`/${uploadDir}/`)) {
    return express.static(path.resolve(uploadDir))(req, res, next);
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/reactions', reactionRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'The Vault API is running' });
});

app.listen(PORT, () => {
  console.log(`The Vault Studio Console running on http://localhost:${PORT}`);
});
