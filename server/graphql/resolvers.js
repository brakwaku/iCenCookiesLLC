import User from "../models/User.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import Order from "../models/Order.js";
import { sendTokenResponse } from "../utils/auth.js";
import { protect, authorize } from "../middleware/auth.js";

function rejectIf(condition, message) {
  if (condition) {
    throw new Error(message);
  }
}

const resolvers = {
  Query: {
    getAllUsers: async (_, args, { req, user }) => {
      // Check if current user is an admin and reject if not
      protect(req);
      authorize("admin", user);
      const users = await User.find();
      return users;
    },

    getUserById: async (_, { id }) => {
      // Implement logic to fetch users from MongoDB
      const user = await User.findById(id);
      return user;
    },

    getAllProducts: async () => {
      try {
        const products = await Product.find();
        return products;
        // // Fetch all products
        // const products = await loaders.productLoader.loadMany(allProductIds);

        // // Fetch associated reviews and users for each product
        // const reviewsWithUsers = await loaders.reviewLoader.loadMany(
        //   allProductIds
        // );

        // // Attach reviews (with users) to their respective products
        // const productsWithReviews = products.map((product, index) => ({
        //   ...product.toObject(), // Convert Mongoose document to plain object
        //   reviews: reviewsWithUsers[index],
        // }));

        // return productsWithReviews;
      } catch (error) {
        console.error("Error fetching products:", error);
        throw error;
      }
    },

    getProductById: async (_, { id }) => {
      // Fetch a single product by ID
      const product = await Product.findById(id);
      return product;
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

    // Password reset request mutation
    requestPasswordReset: async (_, { email }) => {
      try {
        const user = await User.findOne({ email });
        if (!user) {
          throw new Error("User not found");
        }
        // Generate and set the reset token
        const resetToken = user.getResetPasswordToken();
        await user.save();

        // Implement logic to send the resetToken via email or any other preferred method

        return { message: "Password reset email sent successfully" };
      } catch (error) {
        throw new Error(`Password reset request failed: ${error.message}`);
      }
    },

    // Password reset mutation
    resetPassword: async (_, { email, newPassword, resetToken }) => {
      try {
        const user = await User.findOne({
          email,
          resetPasswordToken: resetToken,
        });

        if (!user) {
          throw new Error("Invalid reset token");
        }

        // Check if the reset token has expired
        if (user.resetPasswordExpire < Date.now()) {
          throw new Error("Reset token has expired");
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update the user's password and reset token fields
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

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
        const product = await Product.findByIdAndUpdate(id, input, { new: true });

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
        const productToDelete = await Product.findByIdAndDelete(deleteProductId);
        if (!productToDelete) {
          throw new Error("Product not found");
        }
        return { message: "Product deleted successfully" };
      } catch (error) {
        throw new Error(`Delete product failed: ${error.message}`);
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
