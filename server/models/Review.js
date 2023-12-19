import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a title for the review"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    comment: {
      type: String,
      required: [true, "Please add some comment"],
    },
    rating: {
      type: Number,
      min: 1,
      max: 10,
      required: [true, "Please add a rating between 1 and 10"],
    },
    product: {
      type: mongoose.Schema.ObjectId,
      ref: "Product",
      required: true,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    isSanctioned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent user from submitting more than one review per product
ReviewSchema.index({ user: 1, product: 1 }, { unique: true }); // this is a compound index

// Static method to get avg rating and save
ReviewSchema.statics.getAverageRating = async function (productId) {
  const obj = await this.aggregate([
    {
      $match: { product: productId },
    },
    {
      $group: {
        _id: "$product", // Group by product field
        averageRating: { $avg: "$rating" }, // Create a new field called averageRating and set the value to the avg
      },
    },
  ]);

  try {
    await this.model("Product").findByIdAndUpdate(productId, {
      averageRating: obj[0].averageRating,
    });
  } catch (err) {
    console.error(err);
  }
};

// Call getAverageRating after save
ReviewSchema.post("save", async function () {
  await this.constructor.getAverageRating(this.product);
});

// Call getAverageRating before remove
// ReviewSchema.post(
//   "deleteOne",
//   { document: true, query: false },
//   async function () {
//     console.log(`AverageRating being calculated for product ${this._id}`);
//     await this.constructor.getAverageRating(this.product);
//   }
// );

const Review = mongoose.model("Review", ReviewSchema);

export default Review;
