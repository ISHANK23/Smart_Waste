import mongoose from 'mongoose';
import config from '../config/env.js';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import WasteBin from '../models/WasteBin.js';
import CollectionRecord from '../models/CollectionRecord.js';
import Transaction from '../models/Transaction.js';
import PickupRequest from '../models/PickupRequest.js';
const shouldReset = process.argv.includes('--reset');
const seed = async () => {
  await connectDB(config.database.uri, { debug: config.database.debug });
  if (shouldReset) {
    await Promise.all([
      User.deleteMany({}),
      WasteBin.deleteMany({}),
      CollectionRecord.deleteMany({}),
      Transaction.deleteMany({}),
      PickupRequest.deleteMany({}),
    ]);
    console.log('Cleared existing collections');
  }
  const existingUsers = await User.countDocuments();
  if (existingUsers && !shouldReset) {
    console.log('Database already contains data. Pass --reset to replace it.');
    return;
  }
  const password = process.env.SEED_PASSWORD || 'Password123!';
  const [admin, staff, resident] = await User.create([
    {
      username: 'admin',
      password,
      role: 'admin',
      address: 'HQ 100 Operations Ave',
      phone: '+1-555-1000',
    },
    {
      username: 'staff',
      password,
      role: 'staff',
      address: 'Depot 42 Collection Rd',
      phone: '+1-555-2000',
    },
    {
      username: 'resident',
      password,
      role: 'resident',
      address: '12 Green Way',
      phone: '+1-555-3000',
    },
  ]);
  const bins = await WasteBin.create([
    {
      binId: 'BIN-1001',
      type: 'general',
      location: '12 Green Way Courtyard',
      geoLocation: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        updatedAt: new Date(),
      },
      currentLevel: 45,
      owner: resident._id,
    },
    {
      binId: 'BIN-2001',
      type: 'recyclable',
      location: 'Downtown Recycling Hub',
      geoLocation: {
        latitude: 37.7755,
        longitude: -122.41,
        accuracy: 8,
        updatedAt: new Date(),
      },
      currentLevel: 20,
      owner: staff._id,
    },
  ]);
  await CollectionRecord.create([
    {
      bin: bins[0]._id,
      collectedBy: staff._id,
      weight: 12.4,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      location: {
        latitude: 37.7749,
        longitude: -122.4195,
        accuracy: 6,
        capturedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      },
      distanceFromBin: 4,
      clientReference: 'seed-collection-1',
    },
    {
      bin: bins[1]._id,
      collectedBy: staff._id,
      weight: 9.1,
      timestamp: new Date(),
      location: {
        latitude: 37.7755,
        longitude: -122.41,
        accuracy: 5,
        capturedAt: new Date(),
      },
      distanceFromBin: 3,
      clientReference: 'seed-collection-2',
    },
  ]);
  await PickupRequest.create([
    {
      user: resident._id,
      wasteType: 'bulky',
      description: 'Old furniture removal',
      status: 'scheduled',
      scheduledDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
      clientReference: 'seed-pickup-1',
    },
    {
      user: resident._id,
      wasteType: 'ewaste',
      description: 'Electronics recycling pickup',
      status: 'pending',
      scheduledDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      clientReference: 'seed-pickup-2',
    },
  ]);
  await Transaction.create([
    {
      user: resident._id,
      type: 'payment',
      amount: 24.99,
      status: 'paid',
      clientReference: 'seed-transaction-1',
    },
    {
      user: resident._id,
      type: 'payback',
      amount: 5.5,
      status: 'pending',
      clientReference: 'seed-transaction-2',
    },
    {
      user: admin._id,
      type: 'payment',
      amount: 199.99,
      status: 'paid',
      clientReference: 'seed-transaction-3',
    },
  ]);
  console.log('Seed data created successfully');
  console.log('Login with username "admin", "staff", or "resident" and password:', password);
};
seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });