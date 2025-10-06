import mongoose from 'mongoose';
const CollectionRecordSchema = new mongoose.Schema({
  bin: { type: mongoose.Schema.Types.ObjectId, ref: 'WasteBin', required: true },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weight: { type: Number, required: true }, // kg
  timestamp: { type: Date, default: Date.now },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
    capturedAt: { type: Date }
  },
  distanceFromBin: { type: Number },
  clientReference: { type: String, unique: true, sparse: true }
}, { timestamps: true });
export default mongoose.model('CollectionRecord', CollectionRecordSchema);