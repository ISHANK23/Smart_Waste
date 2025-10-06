import crypto from 'crypto';
import RefreshToken from '../models/RefreshToken.js';
import { signJwt } from './jwt.js';
import config from '../config/env.js';
const parseExpiresInToMs = (expiresIn) => {
  if (typeof expiresIn === 'number') return expiresIn * 1000;
  const match = /^([0-9]+)([smhd])$/.exec(expiresIn);
  if (!match) {
    return 15 * 60 * 1000;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return value * 1000;
  }
};
const ACCESS_TOKEN_TTL = config.jwt.expiresIn || '15m';
const REFRESH_TOKEN_TTL_MS = config.jwt.refreshTtlMs;
const ACCESS_TOKEN_TTL_MS = parseExpiresInToMs(ACCESS_TOKEN_TTL);
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const issueTokenPair = async (user, metadata = {}) => {
  const accessToken = signJwt({ id: user._id, role: user.role }, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const tokenDoc = {
    user: user._id,
    tokenHash,
    expiresAt,
  };
  if (config.tokens.refreshRotateMetadata) {
    tokenDoc.metadata = metadata;
  }
  await RefreshToken.create(tokenDoc);
  return {
    token: accessToken,
    refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString(),
    refreshExpiresAt: expiresAt.toISOString(),
  };
};
export const rotateRefreshToken = async (refreshDoc, user) => {
  if (refreshDoc.revokedAt) {
    throw new Error('Refresh token revoked');
  }
  refreshDoc.revokedAt = new Date();
  await refreshDoc.save();
  return issueTokenPair(user);
};
export const findValidRefreshToken = async (refreshToken) => {
  if (!refreshToken) return null;
  const tokenHash = hashToken(refreshToken);
  const doc = await RefreshToken.findOne({ tokenHash }).populate('user');
  if (!doc) return null;
  if (doc.expiresAt < new Date()) return null;
  if (!doc.user) return null;
  return doc;
};
export const revokeRefreshToken = async (refreshToken) => {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await RefreshToken.findOneAndUpdate({ tokenHash }, { revokedAt: new Date() });
};