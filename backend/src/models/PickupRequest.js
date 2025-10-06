import mongoose from 'mongoose';
const PickupRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  wasteType: { type: String, enum: ['general', 'recyclable', 'organic', 'ewaste', 'bulky'], required: true },
  description: { type: String },
  status: { type: String, enum: ['pending', 'scheduled', 'completed', 'rejected'], default: 'pending' },
  scheduledDate: { type: Date },
  clientReference: { type: String, unique: true, sparse: true }
}, { timestamps: true });
export default mongoose.model('PickupRequest', PickupRequestSchema);
