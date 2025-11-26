"use server";

import connectDB from "@/lib/connectDB";
import UserModel from "@/models/user";
import BillingHistoryModel from "@/models/billingHistory";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Plan to credits mapping
const PLAN_CREDITS = {
  Beginner: 1000,
  "Beginner-Pro": 1000,
  Daily: 2000,
  "Daily-Pro": 2000,
  Creator: 5000,
  "Creator-Pro": 5000,
};

// Price ID to plan mapping (you'll need to update these with your actual Stripe price IDs)
function getPlanDetailsByPriceId(priceId: string) {
  const priceToPlan: {
    [key: string]: { title: string; isYearly: boolean };
  } = {
    [process.env.NEXT_PUBLIC_STRIPE_MONTHLY_BEGINNER ||
    "price_monthly_beginner"]: { title: "Beginner", isYearly: false },
    [process.env.NEXT_PUBLIC_STRIPE_MONTHLY_DAILY ||
    "price_monthly_daily"]: { title: "Daily", isYearly: false },
    [process.env.NEXT_PUBLIC_STRIPE_MONTHLY_CREATOR ||
    "price_monthly_creator"]: { title: "Creator", isYearly: false },
    [process.env.NEXT_PUBLIC_STRIPE_YEARLY_BEGINNER ||
    "price_yearly_beginner"]: { title: "Beginner-Pro", isYearly: true },
    [process.env.NEXT_PUBLIC_STRIPE_YEARLY_DAILY ||
    "price_yearly_daily"]: { title: "Daily-Pro", isYearly: true },
    [process.env.NEXT_PUBLIC_STRIPE_YEARLY_CREATOR ||
    "price_yearly_creator"]: { title: "Creator-Pro", isYearly: true },
  };

  return priceToPlan[priceId] || { title: "Unknown Plan", isYearly: false };
}

// Fetch user data
export async function fetchUser(userId: string) {
  try {
    await connectDB();
    const user = await UserModel.findOne({ userId }).lean();

    if (!user) return null;

    return {
      ...user,
      _id: user._id.toString(),
      userId: user.userId,
      stripeCustomerId: user.stripeCustomerId,
      credits: user.credits || 0,
      subscription: user.subscription || "Free",
    };
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

// Upsert subscription (called by webhook)
export async function upsertSubscription(
  subscription: Stripe.Subscription,
  plan: string
) {
  try {
    await connectDB();
    const customerId = subscription.customer as string;

    const existingUser = await UserModel.findOne({
      stripeCustomerId: customerId,
    });

    // Calculate credits to add based on plan
    const creditsToAdd =
      PLAN_CREDITS[plan as keyof typeof PLAN_CREDITS] || 0;

    const updateData: any = {
      $set: {
        subscription: plan,
        lastCreditAddedDate: new Date(),
      },
    };

    let actualCreditsAdded = 0;

    // Add credits for new subscription with duplicate prevention
    if (creditsToAdd > 0) {
      const currentCredits = existingUser?.credits || 0;

      // Check if credits were recently added (within last 10 minutes) to prevent duplicates
      const recentlyAdded =
        existingUser?.lastCreditAddedDate &&
        new Date().getTime() -
          new Date(existingUser.lastCreditAddedDate).getTime() <
          10 * 60 * 1000;

      if (recentlyAdded && existingUser?.subscription === plan) {
        console.log(
          "Credits recently added - Skipping duplicate credit addition"
        );
        actualCreditsAdded = 0;
      } else {
        updateData.$inc = { credits: creditsToAdd };
        actualCreditsAdded = creditsToAdd;

        console.log("Adding credits for subscription:", {
          customerId,
          plan,
          creditsToAdd,
          currentCredits,
          newTotal: currentCredits + creditsToAdd,
        });
      }
    }

    await UserModel.updateOne({ stripeCustomerId: customerId }, updateData);

    console.log("Subscription update completed:", {
      customerId,
      plan,
      creditsAdded: actualCreditsAdded,
    });

    return actualCreditsAdded;
  } catch (error) {
    console.error("Error upserting subscription:", error);
    throw error;
  }
}

// Save billing history
export async function saveBillingHistory(
  invoice: Stripe.Invoice,
  subscription: Stripe.Subscription,
  planName: string,
  creditsAdded: number
) {
  try {
    await connectDB();

    const priceId = subscription.items.data[0].price.id;
    const planDetails = getPlanDetailsByPriceId(priceId);

    // Check if this invoice already exists to prevent duplicates
    const existingHistory = await BillingHistoryModel.findOne({
      stripeInvoiceId: invoice.id,
    });

    if (existingHistory) {
      console.log("Billing history already exists for invoice:", invoice.id);
      return existingHistory;
    }

    // Mark all previous subscriptions as not current
    await BillingHistoryModel.updateMany(
      { stripeCustomerId: subscription.customer },
      { isCurrentSubscription: false }
    );

    // Find the correct user ID from the database
    const userRecord = await UserModel.findOne({
      stripeCustomerId: subscription.customer,
    });
    const correctUserId =
      userRecord?.userId || subscription.metadata?.userId || subscription.customer;

    // Calculate expected credits for this plan
    const expectedCreditsForPlan =
      PLAN_CREDITS[planName as keyof typeof PLAN_CREDITS] || 0;

    // Create new billing history record
    const billingRecord = new BillingHistoryModel({
      userId: correctUserId,
      stripeCustomerId: subscription.customer,
      stripeSubscriptionId: subscription.id,
      stripeInvoiceId: invoice.id,
      stripePriceId: priceId,
      planName: planName,
      isYearly: planDetails.isYearly,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      creditsAdded: expectedCreditsForPlan,
      status: "active",
      transactionDate: new Date(invoice.created * 1000),
      periodStart: new Date(subscription.current_period_start * 1000),
      periodEnd: new Date(subscription.current_period_end * 1000),
      isCurrentSubscription: true,
    });

    const savedRecord = await billingRecord.save();

    console.log("Billing history saved:", {
      invoiceId: invoice.id,
      subscriptionId: subscription.id,
      planName: planName,
      amount: invoice.amount_paid,
      creditsAdded: expectedCreditsForPlan,
    });

    return savedRecord;
  } catch (error) {
    console.error("Error saving billing history:", error);
    throw error;
  }
}

// Cancel subscription
export async function cancelSubscription(customerId: string) {
  try {
    await connectDB();

    const existingSubscription = await UserModel.findOne({
      stripeCustomerId: customerId,
    });

    if (existingSubscription && existingSubscription.subscription !== "Free") {
      await UserModel.updateOne(
        { stripeCustomerId: customerId },
        { $set: { subscription: "Free" } }
      );
      console.log(`Successfully updated customer ${customerId} to Free plan`);
    }
  } catch (error) {
    console.error("Error canceling subscription:", error);
    throw error;
  }
}

// Fetch credits
export async function fetchCredits(userId: string) {
  try {
    await connectDB();
    const user = await fetchUser(userId);
    if (!user) return 0;
    return user.credits;
  } catch (error) {
    console.error("Error fetching credits:", error);
    return 0;
  }
}

// Validate credits
export async function validateCredits(userId: string, credits: number) {
  try {
    await connectDB();

    const user = await UserModel.findOne({ userId }).lean();
    if (!user) {
      console.log("User not found for userId:", userId);
      return false;
    }

    console.log(
      "User credits:",
      user.credits,
      "Required:",
      credits
    );

    return (user.credits || 0) >= credits;
  } catch (error) {
    console.error("Error validating credits:", error);
    return false;
  }
}

// Deduct credits
export async function deductCredits(userId: string, credits: number) {
  try {
    await connectDB();

    // Use findOneAndUpdate with atomic operation to prevent race conditions
    const result = await UserModel.findOneAndUpdate(
      {
        userId: userId,
        credits: { $gte: credits }, // Only update if user has enough credits
      },
      {
        $inc: { credits: -credits },
      },
      {
        new: true, // Return the updated document
        runValidators: true,
      }
    );

    if (!result) {
      console.log(
        "User not found or insufficient credits for deduction, userId:",
        userId,
        "required credits:",
        credits
      );
      return false;
    }

    console.log(
      "Successfully deducted",
      credits,
      "credits from user",
      userId,
      "remaining credits:",
      result.credits
    );
    return true;
  } catch (error) {
    console.error("Error deducting credits:", error);
    return false;
  }
}

// Get billing history
export async function getBillingHistory(userId: string) {
  try {
    await connectDB();

    let billingHistory = await BillingHistoryModel.find({
      userId: userId,
    })
      .sort({ transactionDate: -1 })
      .lean();

    // If no records found by userId, try to find by stripeCustomerId
    if (billingHistory.length === 0) {
      const user = await UserModel.findOne({ userId: userId });
      if (user?.stripeCustomerId) {
        billingHistory = await BillingHistoryModel.find({
          stripeCustomerId: user.stripeCustomerId,
        })
          .sort({ transactionDate: -1 })
          .lean();
      }
    }

    return billingHistory;
  } catch (error) {
    console.error("Error fetching billing history:", error);
    return [];
  }
}

