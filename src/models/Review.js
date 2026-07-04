import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Enforce one review per customer per product
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

// Helper function to update aggregate rating on Product
export const updateProductAggregateRating = async (productId) => {
  try {
    const Product = mongoose.model('Product');
    const Review = mongoose.model('Review');
    const result = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId.toString()) } },
      { $group: { _id: '$productId', avgRating: { $avg: '$rating' } } }
    ]);

    const avgRating = result.length > 0 ? parseFloat(result[0].avgRating.toFixed(2)) : 0;
    await Product.findByIdAndUpdate(productId, { $set: { rating: avgRating } });
  } catch (err) {
    console.error('Error updating product aggregate rating:', err);
  }
};

// Hook to trigger aggregation on save (MUST be defined before compiling model)
reviewSchema.post('save', async function (doc) {
  await updateProductAggregateRating(doc.productId);
});

const Review = mongoose.model('Review', reviewSchema);

export default Review;
