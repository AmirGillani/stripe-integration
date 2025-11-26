import { Schema, model, models } from "mongoose";

const billingHistorySchema = new Schema(
  {
    userId: { type: String, required: true },
    stripeCustomerId: { type: String, required: true },
    stripeSubscriptionId: { type: String, required: true },
    stripeInvoiceId: { type: String, required: true, unique: true },
    stripePriceId: { type: String, required: true },
    planName: { type: String, required: true },
    isYearly: { type: Boolean, required: true },
    amount: { type: Number, required: true }, // Amount in cents
    currency: { type: String, required: true, default: "usd" },
    creditsAdded: { type: Number, required: false, default: 0 },
    status: {
      type: String,
      required: true,
      enum: ["active", "cancelled", "expired", "upgraded", "downgraded"],
      default: "active",
    },
    transactionDate: { type: Date, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    isCurrentSubscription: { type: Boolean, default: false },
    previousSubscriptionId: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
billingHistorySchema.index({ userId: 1, transactionDate: -1 });
billingHistorySchema.index({ stripeCustomerId: 1, transactionDate: -1 });
billingHistorySchema.index({ userId: 1, status: 1, isCurrentSubscription: 1 });

const BillingHistoryModel =
  models.BillingHistory || model("BillingHistory", billingHistorySchema);

export default BillingHistoryModel;

