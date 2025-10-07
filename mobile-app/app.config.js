const fs = require('fs');
const path = require('path');
const { config: loadEnv } = require('dotenv');
const base = require('./app.json');
const envFiles = ['.env', '.env.local'];
for (const file of envFiles) {
  const envPath = path.resolve(__dirname, file);
  if (fs.existsSync(envPath)) {
    loadEnv({ path: envPath });
  }
}
const extra = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000',
  deployment: process.env.EXPO_PUBLIC_DEPLOYMENT || process.env.NODE_ENV || 'local',
  updatesChannel: process.env.EXPO_PUBLIC_UPDATES_CHANNEL || 'production',
};
module.exports = ({ config = {} }) => ({
  ...base.expo,
  ...config,
  owner: process.env.EXPO_OWNER || config.owner,
  extra: {
    ...(base.expo.extra || {}),
    ...(config.extra || {}),
    ...extra,
    eas: {
      projectId: '67d7c9fb-0434-4f81-9690-428116dd4f01',
    },
  },
});