import mongoose from 'mongoose';

const connectDB = async (uri, { debug = false } = {}) => {
  const connectionUri = uri || process.env.MONGO_URI;
  if (!connectionUri) throw new Error('MONGO_URI not set');
  mongoose.set('strictQuery', true);
  mongoose.set('debug', !!debug);
  await mongoose.connect(connectionUri);
  console.log('MongoDB connected');
};

export default connectDB;
