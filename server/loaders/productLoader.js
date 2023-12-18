import DataLoader from 'dataloader';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import User from '../models/User.js';

const batchLoadProducts = async (productIds) => {
  try {
    const products = await Product.find({ _id: { $in: productIds } });
    return products;
  } catch (error) {
    console.error('Error loading products:', error);
    throw error;
  }
};

// Batch load reviews based on product IDs
const batchLoadReviews = async (productIds) => {
  try {
    const reviews = await Review.find({ product: { $in: productIds } });

    // Extract unique user IDs from reviews
    const userIds = [...new Set(reviews.map((review) => review.user))];

    // Batch load users based on user IDs
    const users = await User.find({ _id: { $in: userIds } });

    // Create a map of userId to user for quick lookup
    const userMap = {};
    users.forEach((user) => {
      userMap[user._id] = user;
    });

    // Group reviews by productId
    const reviewMap = {};
    reviews.forEach((review) => {
      if (!reviewMap[review.product]) {
        reviewMap[review.product] = [];
      }
      reviewMap[review.product].push({
        ...review.toObject(), // Convert Mongoose document to plain object
        user: userMap[review.user],
      });
    });

    // Arrange the reviews in the same order as the input productIds
    const result = productIds.map((productId) => reviewMap[productId] || []);

    return result;
  } catch (error) {
    console.error('Error loading reviews:', error);
    throw error;
  }
};

// Create a DataLoader instance for batch loading products, reviews, and users
const createProductLoader = () => {
  return {
    productLoader: new DataLoader(batchLoadProducts),
    reviewLoader: new DataLoader(batchLoadReviews),
  };
};

export default createProductLoader;
