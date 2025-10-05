import mongoose from 'mongoose';

const CollectionRecordSchema = new mongoose.Schema({
  bin: { type: mongoose.Schema.Types.ObjectId, ref: 'WasteBin', required: true },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weight: { type: Number, required: true }, // kg
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('CollectionRecord', CollectionRecordSchema);
