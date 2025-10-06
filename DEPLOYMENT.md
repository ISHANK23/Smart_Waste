# Smart Waste Deployment & Configuration Guide

This document outlines how to configure the Smart Waste Management System across backend, web, and mobile platforms, as well as how to prepare shared database resources.

## 1. Backend API (Node.js/Express)

### Environment Variables
Copy `backend/.env.example` to one of the following files and update the values with production secrets:

- `backend/.env` — shared defaults for all environments
- `backend/.env.development` — overrides for local development
- `backend/.env.production` — overrides for production builds

Key variables:

| Variable | Description |
| --- | --- |
| `PORT` | API port (defaults to 4000). |
| `MONGO_URI` | MongoDB connection string (Atlas SRV or local). |
| `JWT_SECRET` | Secret used for signing JWT access tokens. |
| `JWT_EXPIRES_IN` | Access token lifetime (`15m`, `1h`, etc.). |
| `JWT_REFRESH_TTL_MS` | Refresh token TTL in milliseconds. |
| `CORS_ORIGIN` | Comma separated list of allowed origins. |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error`. |

### Running locally
```bash
cd backend
npm install
npm run dev
```

### Production start
```bash
NODE_ENV=production npm run start
```

### Docker image
A production-ready Dockerfile is available in `backend/Dockerfile`.

```bash
# Build image
docker build -t smart-waste-backend ./backend

# Run container
docker run -p 4000:4000 \
  -e NODE_ENV=production \
  -e MONGO_URI="<atlas-connection-string>" \
  -e JWT_SECRET="<super-secret>" \
  smart-waste-backend
```

### Database tooling

| Command | Description |
| --- | --- |
| `npm run seed` | Populate demo data if collections are empty. |
| `npm run seed:reset` | Forcefully clear collections before seeding. |
| `npm run db:migrate` | Apply idempotent data migrations. |
| `npm run db:backup` | Run `mongodump` to `./backups/<timestamp>` (requires MongoDB Database Tools). |

## 2. Web Frontend (React)

### Environment variables
Copy `web-frontend/.env.example` to `.env.local` and adjust values. When deploying to Netlify or Vercel, configure these variables in their respective dashboards.

### Build & deploy
```bash
cd web-frontend
npm install
npm run build
```

Docker builds are supported via `web-frontend/Dockerfile`. The output is served by Nginx with SPA-friendly routing.

#### Netlify
Configuration is provided in `web-frontend/netlify.toml`. Set the publish directory to `build/` and command to `npm run build`.

#### Vercel
Configuration is provided in `web-frontend/vercel.json`. Use the **Static Build** preset and ensure environment variables (e.g. `REACT_APP_API_URL`) are defined in Vercel project settings.

## 3. Mobile App (Expo / React Native)

### Environment management
Copy `mobile-app/.env.example` to `.env` or `.env.local` and set:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_DEPLOYMENT`
- (optional) `EXPO_PUBLIC_UPDATES_CHANNEL`

The dynamic config in `mobile-app/app.config.js` loads these variables and wires them into Expo `extra` values for runtime access.

### Building with EAS
The `mobile-app/eas.json` file provides three build profiles (`development`, `preview`, and `production`). Ensure you have the Expo CLI and EAS CLI installed or use the included npm scripts:

```bash
cd mobile-app
npm install
npm run build:android
npm run build:ios
```

### Over-the-air (OTA) Updates
The Expo updates configuration in `mobile-app/app.json` points to the EAS project (`7e2c2d67-7c1f-4ad8-b25d-1447e6443da6`). Publish OTA updates with:

```bash
npm run update:ota -- --message "Describe your update"
```

### Store readiness
`app.json` defines bundle identifiers, icons, splash screens, notification configuration, and permission strings for both iOS and Android. Update these assets as needed before submitting to the App Store or Google Play.

## 4. Shared Services & Database

### MongoDB Atlas
1. Create a cluster in MongoDB Atlas.
2. Add a database user that matches the credentials used in `MONGO_URI`.
3. Allow network access from your hosting provider’s IPs or set up a VPC peering connection.
4. Update `MONGO_URI` in backend environment variables and Docker compose overrides.

### Database seeding & migrations
Use the scripts provided in `backend/src/scripts` to seed demo data and apply migrations. These scripts rely on the configured `MONGO_URI` and can be run from CI/CD pipelines.

### Backups
`npm run db:backup` triggers `mongodump` and stores the output in `./backups/<timestamp>`. Schedule this command (or an equivalent Atlas backup) according to your retention policy.

## 5. Full-stack Docker Compose

A multi-service deployment is defined in `docker-compose.yml` at the repository root. It provisions MongoDB, the backend API, and the production web bundle.

```bash
docker compose up --build
```

Override defaults by exporting environment variables (e.g. `BACKEND_PORT`, `WEB_PORT`, `MONGO_ROOT_USER`). For production, inject secure credentials via a `.env` file or your orchestrator’s secret manager.

---
For additional manual testing workflows see `TESTING.md`.