import { NextResponse } from "next/server";
import Stripe from "stripe";
import connectDB from "@/lib/connectDB";
import UserModel from "@/models/user";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const baseUrl =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_PROD_REDIRECT || "https://yourdomain.com"
    : process.env.STRIPE_REDIRECT_URL || "http://localhost:3000";

const successUrl = `${baseUrl}?stripe=success`;
const cancelUrl = `${baseUrl}?stripe=cancel`;

// Plan mapping
function getPlanDetailsByPriceId(priceId: string) {
  const priceToPlan: {
    [key: string]: { title: string; isYearly: boolean; level: number };
  } = {
    [process.env.NEXT_PUBLIC_STRIPE_MONTHLY_BEGINNER || "price_monthly_beginner"]: {
      title: "Beginner",
      isYearly: false,
      level: 1,
    },
    [process.env.NEXT_PUBLIC_STRIPE_MONTHLY_DAILY || "price_monthly_daily"]: {
      title: "Daily",
      isYearly: false,
      level: 2,
    },
    [process.env.NEXT_PUBLIC_STRIPE_MONTHLY_CREATOR || "price_monthly_creator"]: {
      title: "Creator",
      isYearly: false,
      level: 3,
    },
    [process.env.NEXT_PUBLIC_STRIPE_YEARLY_BEGINNER || "price_yearly_beginner"]: {
      title: "Beginner-Pro",
      isYearly: true,
      level: 1,
    },
    [process.env.NEXT_PUBLIC_STRIPE_YEARLY_DAILY || "price_yearly_daily"]: {
      title: "Daily-Pro",
      isYearly: true,
      level: 2,
    },
    [process.env.NEXT_PUBLIC_STRIPE_YEARLY_CREATOR || "price_yearly_creator"]: {
      title: "Creator-Pro",
      isYearly: true,
      level: 3,
    },
  };

  return priceToPlan[priceId] || { title: "Unknown Plan", isYearly: false, level: 0 };
}

export async function POST(req: Request) {
  try {
    const { price, userId, email, manageSubscription, cancelSubscription } =
      await req.json();

    if (!price && !manageSubscription && !cancelSubscription) {
      return NextResponse.json(
        { error: "Missing price, manageSubscription, or cancelSubscription" },
        { status: 400 }
      );
    }

    if (!userId || !email) {
      return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
    }

    await connectDB();

    // Validate/create customer
    const customer = await validateCustomer(userId, email);

    // Get existing subscriptions
    const subscriptionsResponse = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
    });
    const subscriptions = subscriptionsResponse.data;

    // Handle manage subscription
    if (manageSubscription && subscriptions.length > 0) {
      const stripeSession = await stripe.billingPortal.sessions.create({
        customer: customer.id,
        return_url: baseUrl,
      });
      return NextResponse.json({ url: stripeSession.url });
    }

    // Handle cancel subscription
    if (cancelSubscription && subscriptions.length > 0) {
      for (const subscription of subscriptions) {
        await stripe.subscriptions.cancel(subscription.id);
      }

      // Update user in database
      await UserModel.updateOne(
        { stripeCustomerId: customer.id },
        { $set: { subscription: "Free" } }
      );

      return NextResponse.json({ message: "Subscription cancelled successfully" });
    }

    // Check for duplicate subscription
    if (price && subscriptions.length > 0) {
      const existingSubscription = subscriptions.find((sub) =>
        sub.items.data.some((item) => item.price.id === price)
      );

      if (existingSubscription) {
        const expiryDate = new Date(
          existingSubscription.current_period_end * 1000
        ).toLocaleDateString();
        return NextResponse.json(
          {
            error: `You already have this subscription plan that expires on ${expiryDate}.`,
          },
          { status: 400 }
        );
      }
    }

    // Create checkout session
    if (price) {
      const stripeSession = await stripe.checkout.sessions.create({
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: ["card"],
        mode: "subscription",
        billing_address_collection: "auto",
        customer: customer.id,
        allow_promotion_codes: true,
        line_items: [
          {
            price: price,
            quantity: 1,
          },
        ],
        metadata: {
          userId: userId,
          ...(subscriptions.length > 0
            ? {
                previousSubscriptionIdz: subscriptions
                  .map((subscription) => subscription.id)
                  .join(","),
              }
            : {}),
        },
        payment_method_collection: "if_required",
      });

      return NextResponse.json({ url: stripeSession.url });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Error in checkout API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function validateCustomer(userId: string, email: string) {
  await connectDB();

  let customer: Stripe.Customer | Stripe.DeletedCustomer | null = null;

  // Find user in database
  let user = await UserModel.findOne({ userId }).lean();

  // Create user if not found
  if (!user) {
    const newUser = new UserModel({
      userId: userId,
      subscription: "Free",
      credits: 0,
    });
    await newUser.save();
    user = await UserModel.findOne({ userId }).lean();
  }

  // Retrieve or create Stripe customer
  if (user?.stripeCustomerId) {
    try {
      customer = await stripe.customers.retrieve(user.stripeCustomerId);
      if (customer.deleted) {
        customer = null;
      }
    } catch (error) {
      console.log("Customer not found in Stripe, will create new one");
      customer = null;
    }
  }

  if (!customer || customer.deleted) {
    customer = await stripe.customers.create({
      email: email,
    });

    // Update user with Stripe customer ID
    await UserModel.updateOne(
      { userId: userId },
      { stripeCustomerId: customer.id }
    );
  }

  return customer as Stripe.Customer;
}

