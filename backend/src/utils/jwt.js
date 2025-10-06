import jwt from 'jsonwebtoken';
import config from '../config/env.js';
export const signJwt = (payload, options = {}) => {
  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn || '7d',
    ...options,
  });
};
export const verifyJwt = (token) => {
  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.verify(token, config.jwt.secret);
};