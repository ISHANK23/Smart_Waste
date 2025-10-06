import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '..', '..');
const nodeEnv = process.env.NODE_ENV || 'development';
const envFiles = [
  path.resolve(baseDir, `.env.${nodeEnv}`),
  path.resolve(baseDir, '.env'),
];
envFiles.forEach((envPath) => {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
});
dotenv.config();
const parseOrigins = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};
const toBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};
const toNumber = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};
const config = {
  env: nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  server: {
    port: toNumber(process.env.PORT, 4000),
    corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  },
  database: {
    uri: process.env.MONGO_URI,
    debug: toBool(process.env.MONGO_DEBUG, !['production', 'test'].includes(nodeEnv)),
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTtlMs: toNumber(process.env.JWT_REFRESH_TTL_MS, 30 * 24 * 60 * 60 * 1000),
  },
  tokens: {
    refreshRotateMetadata: toBool(process.env.JWT_TRACK_METADATA, true),
  },
  logging: {
    level: process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'warn' : 'debug'),
  },
};
if (!config.database.uri) {
  console.warn('[config] MONGO_URI is not defined. Database operations will fail until it is set.');
}
if (!config.jwt.secret) {
  console.warn('[config] JWT_SECRET is not defined. Authentication will fail until it is set.');
}
export default config;