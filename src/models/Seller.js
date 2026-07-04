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
    type: mongoose.Schema.Types.Mixed,
    default: {}
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

export default Seller;
