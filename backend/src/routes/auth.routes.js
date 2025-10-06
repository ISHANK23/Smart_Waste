import express from 'express';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { issueTokenPair, findValidRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../utils/token.js';
const router = express.Router();
/**
 * POST /api/auth/register
 * body: { username, password, role?, address?, phone? }
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, role, address, phone } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'username and password required' });
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ message: 'Username already exists' });
    const user = await User.create({ username, password, role, address, phone });
    const tokens = await issueTokenPair(user, { type: 'register' });
    res.status(201).json({
      ...tokens,
      user: { id: user._id, username: user.username, role: user.role, address, phone }
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
/**
 * POST /api/auth/login
 * body: { username, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const tokens = await issueTokenPair(user, { type: 'login', agent: req.get('user-agent') });
    res.json({
      ...tokens,
      user: { id: user._id, username: user.username, role: user.role, address: user.address, phone: user.phone }
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const refreshDoc = await findValidRefreshToken(refreshToken);
    if (!refreshDoc) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    const tokens = await rotateRefreshToken(refreshDoc, refreshDoc.user);
    res.json({
      ...tokens,
      user: {
        id: refreshDoc.user._id,
        username: refreshDoc.user.username,
        role: refreshDoc.user.role,
        address: refreshDoc.user.address,
        phone: refreshDoc.user.phone
      }
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  await revokeRefreshToken(refreshToken);
  res.json({ success: true });
});
router.get('/me', requireAuth, (req, res) => {
  const user = req.user;
  res.json({
    id: user._id,
    username: user.username,
    role: user.role,
    address: user.address,
    phone: user.phone
  });
});
export default router;