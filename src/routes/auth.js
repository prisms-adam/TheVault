const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../db');
const { authenticate } = require('../middleware/auth');
const {
  GoogleOAuthError,
  clearGoogleStateCookie,
  consumeAuthorizationResponse,
  createAuthorizationRequest,
  exchangeAuthorizationCode,
  getAuthConfig,
  upsertGoogleUser,
  verifyGoogleIdToken,
} = require('../auth/googleOAuth');
const { toAuthenticatedUser } = require('../auth/userDto');

const router = express.Router();
const authSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

function appCookieOptions(config = getAuthConfig()) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || Boolean(config.redirectUri?.startsWith('https://')),
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function createAppToken(user) {
  return jwt.sign(
    { userId: user.id, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

function requireLocalAuth(req, res, next) {
  if (!getAuthConfig().localAuthEnabled) {
    return res.status(403).json({ error: 'Local authentication is disabled' });
  }
  next();
}

function stableSsoErrorCode(error) {
  const allowedCodes = new Set([
    'sso_unavailable',
    'sso_cancelled',
    'sso_invalid_state',
    'sso_domain',
    'sso_failed',
  ]);
  return error instanceof GoogleOAuthError && allowedCodes.has(error.code)
    ? error.code
    : 'sso_failed';
}

function logSsoFailure(stage, error) {
  console.warn(`[SSO] stage=${stage} code=${stableSsoErrorCode(error)}`);
}

function ssoFailureRedirect(res, error) {
  const code = stableSsoErrorCode(error);
  return res.redirect(`/vault/login?error=${code}`);
}

router.get('/providers', (req, res) => {
  const { googleEnabled, localAuthEnabled, domain } = getAuthConfig();
  res.json({ googleEnabled, localAuthEnabled, domain });
});

router.get('/google', (req, res) => {
  try {
    res.redirect(createAuthorizationRequest(res));
  } catch (error) {
    logSsoFailure('sso_start', error);
    ssoFailureRedirect(res, error);
  }
});

router.get('/google/callback', async (req, res) => {
  const config = getAuthConfig();
  if (!config.googleEnabled) {
    clearGoogleStateCookie(res, config);
    const error = new GoogleOAuthError('sso_unavailable');
    logSsoFailure('sso_start', error);
    return ssoFailureRedirect(res, error);
  }

  let stage = 'state';
  try {
    const transaction = consumeAuthorizationResponse(req, res, config);
    stage = 'exchange';
    const idToken = await exchangeAuthorizationCode(
      transaction.code,
      transaction.verifier,
      config
    );
    stage = 'verify';
    const identity = await verifyGoogleIdToken(idToken, transaction.nonce, config);
    stage = 'account';
    const user = await upsertGoogleUser(identity);
    stage = 'session';
    res.cookie('token', createAppToken(user), appCookieOptions(config));
    res.redirect(user.isAdmin ? '/vault/admin' : '/vault/');
  } catch (error) {
    logSsoFailure(stage, error);
    ssoFailureRedirect(res, error);
  }
});

router.post('/register', requireLocalAuth, async (req, res) => {
  try {
    const { username, password } = authSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userCount = await prisma.user.count();
    const isAdmin = userCount === 0;
    const user = await prisma.user.create({
      data: { username, password: hashedPassword, isAdmin },
    });
    const token = createAppToken(user);
    res.cookie('token', token, appCookieOptions());
    res.status(201).json({
      message: 'User created',
      user: toAuthenticatedUser(user),
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', requireLocalAuth, async (req, res) => {
  try {
    const { username, password } = authSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.googleSub || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createAppToken(user);
    res.cookie('token', token, appCookieOptions());
    res.json({
      message: 'Logged in successfully',
      user: toAuthenticatedUser(user),
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  const options = appCookieOptions();
  delete options.maxAge;
  res.clearCookie('token', options);
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
