import express from 'express';
import User from '../models/User.js';
import { signJwt } from '../utils/jwt.js';

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
    const token = signJwt({ id: user._id, role: user.role });
    res.status(201).json({
      token,
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
    const token = signJwt({ id: user._id, role: user.role });
    res.json({
      token,
      user: { id: user._id, username: user.username, role: user.role, address: user.address, phone: user.phone }
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
