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
  const uploadDir = await getUploadDir();
  
  // Look for /vault/uploads/ or /vault/[custom_dir]/
  if (req.path.startsWith('/vault/uploads/')) {
    const filePath = req.path.substring(15); // Length of '/vault/uploads/'
    return res.sendFile(path.resolve(uploadDir, filePath), (err) => {
      if (err) next();
    });
  }

  if (uploadDir !== 'uploads' && req.path.startsWith(`/vault/${uploadDir}/`)) {
    const filePath = req.path.substring(uploadDir.length + 8); // Length of '/vault/' + uploadDir + '/'
    return res.sendFile(path.resolve(uploadDir, filePath), (err) => {
      if (err) next();
    });
  }
  next();
});

// Routes
app.use('/vault/api/auth', authRoutes);
app.use('/vault/api/videos', videoRoutes);
app.use('/vault/api/admin', adminRoutes);
app.use('/vault/api/comments', commentRoutes);
app.use('/vault/api/reactions', reactionRoutes);

// Serve Frontend in Production
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use('/vault', express.static(frontendDist));

// Fallback for SPA routing under /vault
app.get('/vault/*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Redirect root to /vault
app.get('/', (req, res) => {
  res.redirect('/vault');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`The Vault Studio Console running on http://0.0.0.0:${PORT}`);
});
