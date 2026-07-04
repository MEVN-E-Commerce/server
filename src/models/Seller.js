import mongoose from 'mongoose';
import User from './User.js';

const sellerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  storeName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  logo: {
    type: String,
    trim: true,
    default: ''
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  payoutInfo: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'restricted'],
    default: 'pending'
  }
}, {
  timestamps: true
});

const Seller = mongoose.model('Seller', sellerSchema);

// Hook to sync User role and status updates to Seller status
User.schema.post('save', async function (doc) {
  try {
    const updatedStatus = doc.sellerStatus;
    // Update Seller profile status when user status changes
    await Seller.updateOne(
      { userId: doc._id },
      { $set: { status: updatedStatus } }
    );
  } catch (err) {
    console.error('Error syncing User status to Seller profile:', err);
  }
});

export default Seller;
