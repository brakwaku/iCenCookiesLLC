import User from "../models/User.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import Order from "../models/Order.js";

function rejectIf(condition) {
  if (condition) {
    throw new Error("Unauthorized");
  }
}

const resolvers = {
  Query: {
    users: async () => {
      // Implement logic to fetch users from MongoDB
      const users = await User.find();
      return users;
    },
    user: async (_, { id }) => {
      // Implement logic to fetch users from MongoDB
      const user = await User.findById(id);
      return user;
    },
    products: async (_, __, { loaders }) => {
      try {
        // Fetch all products
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
    product: async (_, { id }) => {
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
    orders: async () => {
      // Fetch orders from MongoDB
      const orders = await Order.find();
      return orders;
    },
    order: async (_, { id }) => {
      // Fetch a single order by ID
      const order = await Order.findById(id);
      return order;
    },
  },
  Mutation: {
    // User registration mutation
    registerUser: async (_, { userInput }) => {
      try {
        const { name, email, password } = userInput;

        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          throw new Error('User already exists');
        }

        // Hash the password
        // const salt = await bcrypt.genSalt(10);
        // const hashedPassword = await bcrypt.hash(password, salt);

        // Create the user
        const newUser = new User({
          name,
          email,
          password,
        });

        await newUser.save();

        // Sign a JWT token and return it
        const token = newUser.getSignedJwtToken();
        return { token, user: newUser };
      } catch (error) {
        throw new Error(`Registration failed: ${error.message}`);
      }
    },

    // User login mutation
    loginUser: async (_, { email, password }) => {
      try {
        // Check if the user exists
        const user = await User.findOne({ email });
        if (!user) {
          throw new Error('Invalid credentials');
        }

        // Check if the entered password matches the stored hashed password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
          throw new Error('Invalid credentials');
        }

        // Sign a JWT token and return it
        const token = user.getSignedJwtToken();
        return { token, user };
      } catch (error) {
        throw new Error(`Login failed: ${error.message}`);
      }
    },

    // Password reset request mutation
    requestPasswordReset: async (_, { email }) => {
      try {
        const user = await User.findOne({ email });

        if (!user) {
          throw new Error('User not found');
        }

        // Generate and set the reset token
        const resetToken = user.getResetPasswordToken();
        await user.save();

        // Implement logic to send the resetToken via email or any other preferred method

        return { message: 'Password reset email sent successfully' };
      } catch (error) {
        throw new Error(`Password reset request failed: ${error.message}`);
      }
    },

    // Password reset mutation
    resetPassword: async (_, { email, newPassword, resetToken }) => {
      try {
        const user = await User.findOne({ email, resetPasswordToken: resetToken });

        if (!user) {
          throw new Error('Invalid reset token');
        }

        // Check if the reset token has expired
        if (user.resetPasswordExpire < Date.now()) {
          throw new Error('Reset token has expired');
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update the user's password and reset token fields
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        return { message: 'Password reset successful' };
      } catch (error) {
        throw new Error(`Password reset failed: ${error.message}`);
      }
    },

    // Update user details mutation
    updateUser: async (_, { userId, updatedUser }) => {
      try {
        // Implement logic to update user details based on the 'updatedUser' input
        // Make sure to validate and sanitize the input data before updating
        const user = await User.findByIdAndUpdate(userId, updatedUser, { new: true });
        if (!user) {
          throw new Error('User not found');
        }
        return user;
      } catch (error) {
        throw new Error(`Update user details failed: ${error.message}`);
      }
    },
    // Delete user mutation
    deleteUser: async (_, { userId }) => {
      try {
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
          throw new Error('User not found');
        }
        return { message: 'User deleted successfully' };
      } catch (error) {
        throw new Error(`Delete user failed: ${error.message}`);
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
    // Define resolver functions for Product type fields (e.g., reviews)
  },
  Order: {
    // Define resolver functions for Order type fields (e.g., orderItems, shippingAddress, paymentResult)
  },
  Review: {
    // Define resolver functions for Review type fields (e.g., user)
  },
};

export default resolvers;
