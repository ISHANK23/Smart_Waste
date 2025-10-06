import mongoose from 'mongoose';
const TransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['payment', 'payback'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  clientReference: { type: String, unique: true, sparse: true }
}, { timestamps: true });
export default mongoose.model('Transaction', TransactionSchema);
