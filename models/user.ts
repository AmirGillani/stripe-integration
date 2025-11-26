import { Schema, model, models } from "mongoose";

const userSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    subscription: { type: String, default: "Free" },
    stripeCustomerId: { type: String },
    credits: { type: Number, default: 0 },
    lastCreditAddedDate: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
userSchema.index({ stripeCustomerId: 1 });

const UserModel = models.User || model("User", userSchema);

export default UserModel;

