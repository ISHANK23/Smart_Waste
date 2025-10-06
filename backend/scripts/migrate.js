import mongoose from 'mongoose';
import config from '../config/env.js';
import connectDB from '../config/db.js';
import RefreshToken from '../models/RefreshToken.js';
import WasteBin from '../models/WasteBin.js';
import Transaction from '../models/Transaction.js';
const migrations = [
  {
    name: '2024-06-ensure-refresh-token-index',
    up: async () => {
      await RefreshToken.collection.createIndex({ tokenHash: 1 }, { unique: true });
    },
  },
  {
    name: '2024-06-backfill-bin-geolocation-updatedAt',
    up: async () => {
      await WasteBin.updateMany(
        {
          'geoLocation.latitude': { $exists: true },
          'geoLocation.updatedAt': { $exists: false },
        },
        {
          $set: { 'geoLocation.updatedAt': new Date() },
        },
      );
    },
  },
  {
    name: '2024-06-default-transaction-status',
    up: async () => {
      await Transaction.updateMany(
        { status: { $exists: false } },
        { $set: { status: 'pending' } },
      );
    },
  },
];
const run = async () => {
  await connectDB(config.database.uri, { debug: config.database.debug });
  const collection = mongoose.connection.collection('migrations_log');
  await collection.createIndex({ name: 1 }, { unique: true });
  for (const migration of migrations) {
    const applied = await collection.findOne({ name: migration.name });
    if (applied) {
      console.log(`Skipping ${migration.name} (already applied)`);
      continue;
    }
    console.log(`Running migration ${migration.name}`);
    await migration.up();
    await collection.insertOne({ name: migration.name, appliedAt: new Date() });
    console.log(`Applied ${migration.name}`);
  }
};
run()
  .catch((err) => {
    console.error('Migration failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });