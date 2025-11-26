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
    const { price, userId, email, name, manageSubscription, cancelSubscription } =
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

    // Validate/create customer (name will be collected in checkout for Indian compliance)
    const customer = await validateCustomer(userId, email, name);

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
      // Validate price ID format
      if (!price.startsWith("price_")) {
        return NextResponse.json(
          {
            error: `Invalid price ID format. You provided: "${price}". Price IDs must start with "price_". You may have used a product ID (starts with "prod_") instead. Please use the Price ID from your Stripe Dashboard.`,
            hint: "In Stripe Dashboard: Products → Select your product → Find the price under 'Pricing' → Copy the Price ID (starts with 'price_')",
          },
          { status: 400 }
        );
      }

      // Verify price exists in Stripe
      try {
        await stripe.prices.retrieve(price);
      } catch (error: any) {
        if (error.code === "resource_missing") {
          return NextResponse.json(
            {
              error: `Price ID "${price}" not found in your Stripe account. Please check:`,
              details: [
                "1. Make sure you're using the correct Stripe account (test vs live mode)",
                "2. Verify the price ID in your Stripe Dashboard",
                "3. Ensure the price is active and not archived",
                `4. You may have used a product ID (prod_xxx) instead of a price ID (price_xxx)`,
              ],
              providedPriceId: price,
            },
            { status: 400 }
          );
        }
        throw error; // Re-throw other errors
      }

      const stripeSession = await stripe.checkout.sessions.create({
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: ["card"],
        mode: "subscription",
        // Required for Indian regulations - collect customer name and address
        billing_address_collection: "required", // Required for Indian export transactions
        // Use existing customer (email is already set on the customer)
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
        // Required for Indian compliance - update customer with name and address
        customer_update: {
          address: "auto", // Automatically update customer address from checkout
          name: "auto", // Automatically update customer name from checkout
        },
      });

      return NextResponse.json({ url: stripeSession.url });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in checkout API:", error);
    
    // Provide helpful error messages for common Stripe errors
    if (error?.type === "StripeInvalidRequestError") {
      if (error?.code === "resource_missing") {
        return NextResponse.json(
          {
            error: "Stripe resource not found",
            details: error.message,
            hint: "Make sure you're using Price IDs (starts with 'price_') not Product IDs (starts with 'prod_'). See HOW_TO_GET_PRICE_IDS.md for help.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error: "Stripe API error",
          details: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error?.message || "Unknown error occurred"
      },
      { status: 500 }
    );
  }
}

async function validateCustomer(userId: string, email: string, name?: string) {
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

  // Type assertion to handle Mongoose lean() return type
  const userDoc = user as any;

  // Retrieve or create Stripe customer
  if (userDoc?.stripeCustomerId) {
    try {
      customer = await stripe.customers.retrieve(userDoc.stripeCustomerId);
      if (customer.deleted) {
        customer = null;
      }
    } catch (error) {
      console.log("Customer not found in Stripe, will create new one");
      customer = null;
    }
  }

  if (!customer || customer.deleted) {
    // Create customer with email and name (if provided)
    // Note: For Indian compliance, name and address will be collected in checkout
    const customerData: Stripe.CustomerCreateParams = {
      email: email,
    };
    
    if (name) {
      customerData.name = name;
    }
    
    customer = await stripe.customers.create(customerData);

    // Update user with Stripe customer ID
    await UserModel.updateOne(
      { userId: userId },
      { stripeCustomerId: customer.id }
    );
  }

  return customer as Stripe.Customer;
}

