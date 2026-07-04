import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true },
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  country: { type: String, trim: true }
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['customer', 'seller', 'admin'],
    default: 'customer'
  },
  sellerStatus: {
    type: String,
    enum: ['pending', 'approved', 'restricted'],
    default: 'approved'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  addresses: {
    type: [addressSchema],
    default: []
  },
  wishlist: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],
    default: []
  },
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  }
}, {
  timestamps: true
});

// Hook to sync User role and status updates to Seller status
userSchema.post('save', async function (doc) {
  try {
    const Seller = mongoose.model('Seller');
    const updatedStatus = doc.sellerStatus;
    await Seller.updateOne(
      { userId: doc._id },
      { $set: { status: updatedStatus } }
    );
  } catch (err) {
    console.error('Error syncing User status to Seller profile:', err);
  }
});

const User = mongoose.model('User', userSchema);

export default User;
