import mongoose from 'mongoose';
const WasteBinSchema = new mongoose.Schema({
  binId: { type: String, required: true, unique: true, trim: true },
  type: { type: String, enum: ['general', 'recyclable'], default: 'general' },
  location: { type: String, required: true }, // keep simple; can later be GeoJSON
  geoLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
    updatedAt: { type: Date }
  },
  currentLevel: { type: Number, default: 0 }, // 0..100 (%)
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
export default mongoose.model('WasteBin', WasteBinSchema);
