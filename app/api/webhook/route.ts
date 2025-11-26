import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { upsertSubscription, saveBillingHistory, cancelSubscription } from "@/actions/user";
import BillingHistoryModel from "@/models/billingHistory";

// Track processed events to prevent duplicates
const processedEvents = new Set<string>();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const webhookSecret =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_WEBHOOK_SECRET_PROD
    : process.env.STRIPE_WEBHOOK_SECRET;

// Plan mapping
const planlist = [
  {
    title: "Beginner",
    priceId: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_BEGINNER || "price_monthly_beginner",
    isYearly: false,
  },
  {
    title: "Daily",
    priceId: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_DAILY || "price_monthly_daily",
    isYearly: false,
  },
  {
    title: "Creator",
    priceId: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_CREATOR || "price_monthly_creator",
    isYearly: false,
  },
  {
    title: "Beginner-Pro",
    priceId: process.env.NEXT_PUBLIC_STRIPE_YEARLY_BEGINNER || "price_yearly_beginner",
    isYearly: true,
  },
  {
    title: "Daily-Pro",
    priceId: process.env.NEXT_PUBLIC_STRIPE_YEARLY_DAILY || "price_yearly_daily",
    isYearly: true,
  },
  {
    title: "Creator-Pro",
    priceId: process.env.NEXT_PUBLIC_STRIPE_YEARLY_CREATOR || "price_yearly_creator",
    isYearly: true,
  },
];

function getPlanDetailsByPriceId(priceId: string) {
  const plan = planlist.find((plan) => plan.priceId === priceId);
  if (!plan) {
    console.error(`No plan found for priceId: ${priceId}`);
    return { title: "Unknown Plan", isYearly: false };
  }
  return { title: plan.title, isYearly: plan.isYearly };
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  let data;
  let eventType;
  let event;

  // Verify Stripe event is legit
  try {
    event = stripe.webhooks.constructEvent(body, signature!, webhookSecret!);
  } catch (err: any) {
    console.error(`Webhook signature verification failed. ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  data = event.data;
  eventType = event.type;

  console.log("🔔 WEBHOOK EVENT RECEIVED:", {
    eventType: eventType,
    eventId: event.id,
    timestamp: new Date().toISOString(),
  });

  // Check if this event has already been processed
  const eventKey = `${event.id}_${eventType}`;
  if (processedEvents.has(eventKey)) {
    console.log("🔄 DUPLICATE EVENT DETECTED - Skipping processing");
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Mark event as being processed
  processedEvents.add(eventKey);

  // Clean up old processed events (keep only last 1000)
  if (processedEvents.size > 1000) {
    const eventsArray = Array.from(processedEvents);
    const toDelete = eventsArray.slice(0, 100);
    toDelete.forEach((event) => processedEvents.delete(event));
  }

  try {
    switch (eventType) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata;

        console.log("Checkout session completed:", {
          sessionId: session.id,
          customerId: session.customer,
          metadata: metadata,
        });

        // Cancel previous subscriptions if any
        const previousSubscriptionIds = metadata?.previousSubscriptionIdz?.split(",");
        if (previousSubscriptionIds) {
          console.log("Canceling previous subscriptions:", previousSubscriptionIds);
          await new Promise((resolve) => setTimeout(resolve, 1000));

          for (const subscriptionId of previousSubscriptionIds) {
            try {
              await stripe.subscriptions.cancel(subscriptionId);
              console.log(`Successfully canceled subscription: ${subscriptionId}`);
            } catch (error: any) {
              if (error.code === "resource_missing") {
                console.log(`Subscription ${subscriptionId} already cancelled`);
              } else {
                console.error(`Error canceling subscription ${subscriptionId}:`, error);
              }
            }
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        console.log("💰 INVOICE PAYMENT SUCCEEDED:", {
          invoiceId: invoice.id,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          customerId: invoice.customer,
          subscriptionId: invoice.subscription,
        });

        const subscriptionId =
          invoice?.subscription || (invoice as any)?.parent?.subscription_details?.subscription;

        if (!subscriptionId) {
          console.log("❌ No subscription ID found in invoice:", invoice.id);
          break;
        }

        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
          const priceId = subscription.items.data[0].price.id;
          const planDetails = getPlanDetailsByPriceId(priceId);

          console.log("📋 SUBSCRIPTION DETAILS:", {
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            plan: planDetails.title,
            priceId: priceId,
            status: subscription.status,
          });

          // Additional duplicate prevention
          const invoiceKey = `invoice_${invoice.id}_${subscription.customer}`;
          if (processedEvents.has(invoiceKey)) {
            console.log("🔄 DUPLICATE INVOICE PAYMENT DETECTED - Skipping");
            break;
          }

          processedEvents.add(invoiceKey);

          // Update subscription and add credits
          const creditsAdded = await upsertSubscription(subscription, planDetails.title);
          console.log("Credits added:", creditsAdded);

          // Save billing history
          try {
            await saveBillingHistory(invoice, subscription, planDetails.title, creditsAdded || 0);
            console.log("✅ Billing history saved successfully");
          } catch (billingHistoryError) {
            console.error("❌ Error saving billing history:", billingHistoryError);
          }
        } catch (error) {
          console.error("❌ ERROR processing invoice.payment_succeeded:", error);
          throw error;
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer;

        console.log("New subscription created:", {
          subscriptionId: subscription.id,
          customerId: customerId,
          status: subscription.status,
        });

        const subscriptionKey = `subscription_created_${subscription.id}_${customerId}`;
        if (processedEvents.has(subscriptionKey)) {
          console.log("🔄 DUPLICATE SUBSCRIPTION CREATION DETECTED");
          break;
        }

        processedEvents.add(subscriptionKey);

        if (subscription.status === "active" || subscription.status === "trialing") {
          try {
            const priceId = subscription.items.data[0].price.id;
            const planDetails = getPlanDetailsByPriceId(priceId);
            await upsertSubscription(subscription, planDetails.title);
            console.log("Successfully processed new subscription");
          } catch (error) {
            console.error("Error processing new subscription:", error);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer;

        console.log("Subscription updated:", {
          subscriptionId: subscription.id,
          customerId: customerId,
          status: subscription.status,
        });

        const updateKey = `subscription_updated_${subscription.id}_${customerId}_${subscription.status}`;
        if (processedEvents.has(updateKey)) {
          console.log("🔄 DUPLICATE SUBSCRIPTION UPDATE DETECTED");
          break;
        }

        processedEvents.add(updateKey);

        if (subscription.status === "active") {
          try {
            const priceId = subscription.items.data[0].price.id;
            const planDetails = getPlanDetailsByPriceId(priceId);
            await upsertSubscription(subscription, planDetails.title);
            console.log("Successfully updated subscription");
          } catch (error) {
            console.error("Error processing subscription update:", error);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer;

        console.log("Subscription deleted:", {
          subscriptionId: subscription.id,
          customerId: customerId,
        });

        // Update billing history
        try {
          await BillingHistoryModel.updateMany(
            { stripeSubscriptionId: subscription.id },
            { status: "cancelled", isCurrentSubscription: false }
          );
          console.log("✅ Updated billing history for cancelled subscription");
        } catch (billingUpdateError) {
          console.error("❌ Error updating billing history:", billingUpdateError);
        }

        // Add delay to allow other webhook events to process first
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Check if customer has any active subscriptions
        try {
          const activeSubscriptions = await stripe.subscriptions.list({
            customer: customerId as string,
            status: "active",
          });

          if (activeSubscriptions.data.length === 0) {
            console.log(`No subscriptions found for customer ${customerId}, setting to Free plan`);
            await cancelSubscription(customerId as string);
          } else {
            console.log(`Customer has other subscriptions - not setting to Free`);
          }
        } catch (error) {
          console.error("Error checking customer subscriptions:", error);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }
  } catch (e: any) {
    console.error("Webhook processing failed:", {
      eventType: eventType,
      error: e.message,
      stack: e.stack,
    });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

