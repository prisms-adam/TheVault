const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { authenticatedUserSelect, toAuthenticatedUser } = require('../auth/userDto');
const { getAuthConfig } = require('../auth/googleOAuth');

const authenticate = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: authenticatedUserSelect,
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    const authenticatedUser = toAuthenticatedUser(user);
    const authConfig = getAuthConfig();
    if (!authConfig.localAuthEnabled && !authenticatedUser.isSchoolAccount) {
      res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production' || Boolean(authConfig.redirectUri?.startsWith('https://')),
        path: '/',
      });
      return res.status(401).json({ error: 'Unauthorized: School Google sign-in required' });
    }

    req.user = authenticatedUser;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const authorizeAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};

module.exports = { authenticate, authorizeAdmin };
