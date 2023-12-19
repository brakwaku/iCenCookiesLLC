import crypto from "crypto";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import Order from "../models/Order.js";
import Preferences from "../models/Preferences.js";
import sendEmail from "../utils/sendEmail.js";
import { sendTokenResponse } from "../utils/auth.js";
import { protect, authorize } from "../middleware/auth.js";

function rejectIf(condition, message) {
  if (condition) {
    throw new Error(message);
  }
}

const resolvers = {
  Query: {
    getAllUsers: async (_, __, { req, user }) => {
      // Check if current user is an admin and reject if not
      protect(req);
      authorize("admin", user);
      const users = await User.find();
      return users;
    },

    getUserById: async (_, { id }, { req }) => {
      protect(req);
      const user = await User.findById(id);
      return user;
    },

    getAllProducts: async (_, __, { loaders }) => {
      try {
        const allProductIds = await Product.find({}, "_id");
        const products = await loaders.productLoader.loadMany(allProductIds);

        // Fetch associated reviews and users for each product
        const reviewsWithUsers = await loaders.reviewLoader.loadMany(
          allProductIds
        );

        // Attach reviews (with users) to their respective products
        const productsWithReviews = products.map((product, index) => ({
          ...product.toObject(), // Convert Mongoose document to plain object
          reviews: reviewsWithUsers[index],
        }));

        return productsWithReviews;
      } catch (error) {
        console.error("Error fetching products:", error);
        throw error;
      }
    },

    getProductById: async (_, { id }) => {
      // Fetch a single product by ID
      const product = await Product.findById(id).populate({
        path: "reviews", // Populate reviews
        model: "Review",
        populate: {
          path: "user", // In each review, populate the user
          model: "User",
        },
      });
      const productToReturn = { ...product.toObject() };
      return productToReturn;
    },

    // Get all reviews for a product
    getProductReviews: async (_, { productId }) => {
      try {
        // Fetch all reviews for the product
        const reviews = await Review.find({ product: productId });
        return reviews;
      } catch (error) {
        throw new Error(`Get product reviews failed: ${error.message}`);
      }
    },

    reviews: async () => {
      // Fetch reviews from MongoDB
      const reviews = await Review.find();
      return reviews;
    },

    review: async (_, { id }) => {
      // Fetch a single review by ID
      const review = await Review.findById(id);
      return review;
    },

    getAllUserOrders: async () => {
      // Fetch orders from MongoDB
      const orders = await Order.find();
      return orders;
    },

    getOrderById: async (_, { id }) => {
      // Fetch a single order by ID
      const order = await Order.findById(id);
      return order;
    },
  },

  Mutation: {
    // Create  new User
    registerUser: async (_, { userInput }, { res }) => {
      try {
        const { email } = userInput;
        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          throw new Error("User already exists");
        }
        // Create the user
        const user = new User(userInput);
        await user.save();
        // Generate and send the token response
        sendTokenResponse(user, res);

        return { token: user.getSignedJwtToken(), user, success: true };
      } catch (error) {
        throw new Error(`Registration failed: ${error.message}`);
      }
    },

    // User login mutation
    loginUser: async (_, { email, password }, { res }) => {
      try {
        // Check if the user exists
        const user = await User.findOne({ email }).select("+password");
        if (!user) {
          throw new Error("Invalid credentials");
        }
        // Check if the entered password matches the stored hashed password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
          throw new Error("Invalid credentials");
        }
        // Generate and send the token response
        sendTokenResponse(user, res);

        return { token: user.getSignedJwtToken(), user, success: true };
      } catch (error) {
        throw new Error(`Login failed: ${error.message}`);
      }
    },

    // User logout mutation
    logoutUser: async (_, __, { res, req, user }) => {
      try {
        // Set the token cookie to none and set the expiration date to 10 seconds from now
        res.cookie("token", "none", {
          expires: new Date(Date.now() + 10 * 1000), // 10 seconds
          httpOnly: true, // can't access the cookie in the browser
        });

        req.user = null;
        user = null;

        return {
          success: true,
          message: "Logout successful",
          data: {},
        };
      } catch (error) {
        console.error(error);
        return {
          success: false,
          message: "Logout failed",
        };
      }
    },

    // @desc    Forgot password
    // @access  Public
    forgotPasswordRequest: async (_, { email }, { req }) => {
      const user = await User.findOne({ email });
      try {
        if (!user) {
          return {
            message: "There is no user with that email",
          };
        }
        // Generate and set the reset token
        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        // Create reset url
        const resetUrl = `${req.protocol}://${req.get(
          "host"
        )}/resetpassword/${resetToken}`;
        // Create message
        const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please follow this link to reset your password: \n\n ${resetUrl}`;
        await sendEmail({
          email: user.email,
          subject: "Password reset request",
          message,
        });

        return { message: "Password reset email sent successfully" };
      } catch (error) {
        console.log(error);
        // Reset the fields in the user model
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        // Save the user
        await user.save({ validateBeforeSave: false });
        throw new Error(`Password reset request failed: ${error.message}`);
      }
    },

    // Forgot password mutation
    forgotPassword: async (_, { newPassword, resetToken }, { res }) => {
      try {
        // Get hashed token from the params
        const resetPasswordToken = crypto
          .createHash("sha256")
          .update(resetToken)
          .digest("hex");

        const user = await User.findOne({
          resetPasswordToken,
          resetPasswordExpire: { $gt: Date.now() },
        }); // check if the token is valid and not expired

        if (!user) {
          throw new Error("Invalid reset token");
        }

        // Check if the reset token has expired
        if (user.resetPasswordExpire < Date.now()) {
          throw new Error("Reset token has expired");
        }

        // Set new password
        user.password = newPassword; // set the new password
        user.resetPasswordToken = undefined; // reset the fields
        user.resetPasswordExpire = undefined; // reset the fields
        await user.save(); // save the user

        sendTokenResponse(user, res); // send token

        return { message: "Password reset successful" };
      } catch (error) {
        throw new Error(`Password reset failed: ${error.message}`);
      }
    },

    // Password reset mutation
    resetPassword: async (
      _,
      { currentPassword, newPassword },
      { res, req, user: { id } }
    ) => {
      protect(req);
      try {
        const user = await User.findById(id).select("+password");

        // Check current password
        if (!(await user.matchPassword(currentPassword))) {
          throw new Error("Password is incorrect");
        }

        user.password = newPassword; // set the new password
        await user.save(); // save the user

        sendTokenResponse(user, res); // send token

        return { message: "Password reset successful" };
      } catch (error) {
        throw new Error(`Password reset failed: ${error.message}`);
      }
    },

    // Update user details mutation
    updateUser: async (_, { userId, updatedUser }, { req }) => {
      await protect(req);
      try {
        // findByIdAndUpdate() bypasses the mongoose middleware, so I use findById() and then save()
        let user = await User.findById(userId);
        // if no user is found
        if (!user) {
          throw new Error(`User not found with id of ${userId}`);
        }
        // update the user
        user = await User.findByIdAndUpdate(userId, updatedUser, {
          new: true,
          runValidators: true,
        });

        return user;
      } catch (error) {
        throw new Error(`Update user details failed: ${error.message}`);
      }
    },

    // Delete user mutation
    deleteUser: async (_, { deleteUserId }, { req, user }) => {
      // Check if there is a logged in user and reject if not
      rejectIf(user === undefined || null, "Please login to continue");
      await protect(req);
      await authorize("admin", user);
      try {
        const userToDelete = await User.findByIdAndDelete(deleteUserId);
        if (!userToDelete) {
          throw new Error("User not found");
        }
        return { message: "User deleted successfully" };
      } catch (error) {
        throw new Error(`Delete user failed: ${error.message}`);
      }
    },

    // Create product mutation
    createProduct: async (_, { input }, { req, user }) => {
      // Check if the user is logged in and reject if not
      await protect(req);
      authorize("admin", user);
      const userId = user?.id;

      const productInput = { ...input, user: userId };
      try {
        // Save the new product to the database
        const product = await Product.create(productInput);

        return product;
      } catch (error) {
        throw new Error(`Product creation failed: ${error.message}`);
      }
    },

    // Update product mutation
    updateProduct: async (_, { id, input }, { req, user }) => {
      // Check if the user is logged in and reject if not
      await protect(req);
      authorize("admin", user);

      try {
        // Save the updated product to the database
        const product = await Product.findByIdAndUpdate(id, input, {
          new: true,
        });

        return product;
      } catch (error) {
        throw new Error(`Product update failed: ${error.message}`);
      }
    },

    // Delete product mutation
    deleteProduct: async (_, { deleteProductId }, { req, user }) => {
      // Check if there is a logged in user and reject if not
      rejectIf(user === undefined || null, "Please login to continue");
      await protect(req);
      await authorize("admin", user);
      try {
        const productToDelete = await Product.findByIdAndDelete(
          deleteProductId
        );
        if (!productToDelete) {
          throw new Error("Product not found");
        }
        return { message: "Product deleted successfully" };
      } catch (error) {
        throw new Error(`Delete product failed: ${error.message}`);
      }
    },

    // Create review mutation
    createReview: async (_, { input }, { req, user }) => {
      // Check if the user is logged in and reject if not
      await protect(req);
      const userId = user?.id;

      const reviewInput = { ...input, user: userId };
      try {
        // Save the new review to the database
        const review = await Review.create(reviewInput);
        await review.populate({ path: "user", model: "User" });
        let product = await Product.findById(input.product);
        product.reviews.push(review._id);
        product.numReviews = product.reviews.length;
        await product.save();

        return review;
      } catch (error) {
        if (error.code === 11000) {
          // Handle the duplicate key error
          console.error(
            "A user cannot review the same product more than once."
          );
          throw new Error(
            `A user cannot review the same product more than once.`
          );
        } else {
          throw new Error(`Review creation failed: ${error.message}`);
        }
      }
    },

    // Update review mutation
    updateReview: async (_, { id, input }, { req, user }) => {
      // Check if the user is logged in and reject if not
      await protect(req);

      // Check if the user is the owner of the review and reject if not
      if (user.id !== input.user) {
        throw new Error("You are not authorized to update this review");
      }

      try {
        // Save the updated review to the database
        const review = await Review.findByIdAndUpdate(id, input, {
          new: true,
        });
        await review.populate({ path: "user", model: "User" });

        return review;
      } catch (error) {
        throw new Error(`Review update failed: ${error.message}`);
      }
    },

    // Delete review mutation | Only admins can delete reviews
    deleteReview: async (_, { deleteReviewId }, { req, user }) => {
      // Check if there is a logged in user and reject if not
      await protect(req);
      await authorize("admin", user);

      const review = await Review.findById(deleteReviewId);
      const productId = review.product;
      // Update the product
      await Product.updateOne(
        { _id: productId },
        {
          $pull: { reviews: review.id },
          $inc: { numReviews: -1 },
        }
      );

      // // Check if the user is the owner of the review and reject if not
      // if (user.id !== review.user.toString()) {
      //   throw new Error("You are not authorized to delete this review");
      // }

      try {
        await review.deleteOne();
        return { message: "Review deleted successfully" };
      } catch (error) {
        throw new Error(`Delete review failed: ${error.message}`);
      }
    },

    // Create order mutation
    createOrder: async (_, { input }, { req, user }) => {
      // Check if the user is logged in and reject if not
      await protect(req);
      const userId = user?.id;

      const orderInput = { ...input, user: userId };
      try {
        // Save the new order to the database
        const order = await Order.create(orderInput);

        return order;
      } catch (error) {
        throw new Error(`Order creation failed: ${error.message}`);
      }
    },

    // Update order mutation
    updateOrder: async (_, { id, input }, { req, user }) => {
      // Check if the user is logged in and reject if not
      await protect(req);
      const oldOrder = await Order.findById(id);

      // Check if the user is the owner of the order or an admin and reject if not
      if (user.id !== oldOrder.user.toString() || user.role !== "admin") {
        throw new Error("You are not authorized to update this order");
      }
      try {
        // Save the updated order to the database
        const order = await Order.findByIdAndUpdate(id, input, {
          new: true,
        });

        return order;
      } catch (error) {
        throw new Error(`Order update failed: ${error.message}`);
      }
    },

    // Delete order mutation
    deleteOrder: async (_, { deleteOrderId }, { req, user }) => {
      // Check if there is a logged in user and reject if not
      await protect(req);
      const oldOrder = await Order.findById(deleteOrderId);

      // Check if the user is the owner of the order or an admin and reject if not
      if (user.id !== oldOrder.user.toString() || user.role !== "admin") {
        throw new Error("You are not authorized to delete this order");
      }
      try {
        const orderToDelete = await Order.findByIdAndDelete(deleteOrderId);
        if (!orderToDelete) {
          throw new Error("Order not found");
        }
        return { message: "Order deleted successfully" };
      } catch (error) {
        throw new Error(`Delete order failed: ${error.message}`);
      }
    },

    // Create preferences mutation
    createPreferences: async (_, { input }, { req, user }) => {
      // Check if the user is logged in and reject if not
      await protect(req);
      const userId = user?.id;

      const preferencesInput = { ...input, user: userId };
      try {
        // Save the new preferences to the database
        const preferences = await Preferences.create(preferencesInput);
        await preferences.populate({ path: "order", model: "Order" });

        return preferences;
      } catch (error) {
        throw new Error(`Preferences creation failed: ${error.message}`);
      }
    },

    // Update preferences mutation
    updatePreferences: async (_, { id, input }, { req, user }) => {
      // Check if the user is logged in and reject if not
      await protect(req);

      // Check if the user is the owner of the preferences and reject if not
      if (user.id !== input.user) {
        throw new Error("You are not authorized to update these preferences");
      }

      try {
        // Save the updated preferences to the database
        const preferences = await Preferences.findByIdAndUpdate(id, input, {
          new: true,
        });
        await preferences.populate({ path: "order", model: "Order" });

        return preferences;
      } catch (error) {
        throw new Error(`Preferences update failed: ${error.message}`);
      }
    },

    // Delete preferences mutation
    deletePreferences: async (_, { deletePreferencesId }, { req, user }) => {
      // Check if there is a logged in user and reject if not
      await protect(req);

      // Check if the user is the owner of the preferences and reject if not
      if (user.id !== deletePreferencesId) {
        throw new Error("You are not authorized to delete these preferences");
      }

      try {
        const preferencesToDelete = await Preferences.findByIdAndDelete(
          deletePreferencesId
        );
        if (!preferencesToDelete) {
          throw new Error("Preferences not found");
        }
        return { message: "Preferences deleted successfully" };
      } catch (error) {
        throw new Error(`Delete preferences failed: ${error.message}`);
      }
    },
  },

  User: {
    // Resolver function for the 'address' field of the User type
    address: async (parent) => {
      return parent.address; // Assuming 'address' is a simple field in the User model
    },

    // Resolver function for the 'orders' field of the User type
    orders: async (parent) => {
      // Assuming the 'orders' field in the User model is an array of Order IDs
      return await Order.find({ user: parent._id });
    },

    // Resolver function for the 'preferences' field of the User type
    preferences: async (parent) => {
      return parent.preferences; // Assuming 'preferences' is a simple field in the User model
    },
    createdAt: (parent) => {
      return parent.createdAt.toISOString(); // Convert to ISO string for GraphQL scalar type
    },
  },
  Product: {
    reviews: async (product, args, { loaders }) => {
      return loaders.reviewLoader.load(product._id);
    },
  },
  Order: {
    // Define resolver functions for Order type fields (e.g., orderItems, shippingAddress, paymentResult)
  },
  Review: {
    user: async (review, args, context) => {
      // Assuming user information is already included in the review from the batchLoadReviews function
      return review.user;
    },
  },
};

export default resolvers;
