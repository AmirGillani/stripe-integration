# Stripe Credit-Based System Integration Guide

This guide explains how the credit-based Stripe integration works, based on the Creashort project implementation.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [How It Works](#how-it-works)
5. [Key Components](#key-components)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## 🎯 Overview

This implementation provides a complete credit-based subscription system using Stripe. When users subscribe to a plan, they receive credits that can be used for various features in your application.

### Key Features

- ✅ Credit-based subscription system
- ✅ Automatic credit allocation on subscription
- ✅ Credit deduction with validation
- ✅ Billing history tracking
- ✅ Webhook handling for subscription events
- ✅ Duplicate payment prevention
- ✅ Subscription management (upgrade/downgrade/cancel)

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │
│  (Next.js)  │
└──────┬──────┘
       │
       ├───► /api/checkout ────► Stripe Checkout
       │
       ├───► /api/webhook ◄───── Stripe Webhooks
       │
       └───► /api/user ─────────► MongoDB
              │
              ├─── User Model (credits, subscription)
              └─── BillingHistory Model (transactions)
```

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
npm install stripe mongoose dotenv
```

### 2. Set Up MongoDB

1. Create a MongoDB Atlas account or use a local MongoDB instance
2. Get your connection string
3. Add it to `.env.local`:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```

### 3. Set Up Stripe

1. Create a Stripe account at https://stripe.com
2. Get your API keys from the Stripe Dashboard
3. Create products and prices in Stripe Dashboard:
   - Create 3 products: Beginner, Daily, Creator
   - For each product, create:
     - Monthly price (recurring, monthly)
     - Yearly price (recurring, yearly)
4. Copy the Price IDs and add them to `.env.local`

### 4. Configure Webhooks

1. In Stripe Dashboard, go to Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhook`
3. Select events to listen to:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook signing secret to `.env.local`

### 5. Environment Variables

Create `.env.local` file:

```env
# MongoDB
MONGODB_URI=your_mongodb_connection_string

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
NEXT_PUBLIC_STRIPE_MONTHLY_BEGINNER=price_...
NEXT_PUBLIC_STRIPE_MONTHLY_DAILY=price_...
NEXT_PUBLIC_STRIPE_MONTHLY_CREATOR=price_...
NEXT_PUBLIC_STRIPE_YEARLY_BEGINNER=price_...
NEXT_PUBLIC_STRIPE_YEARLY_DAILY=price_...
NEXT_PUBLIC_STRIPE_YEARLY_CREATOR=price_...

# URLs
STRIPE_REDIRECT_URL=http://localhost:3000
STRIPE_PROD_REDIRECT=https://yourdomain.com
```

## 🔄 How It Works

### 1. User Subscribes

```
User clicks "Subscribe" 
  → POST /api/checkout
  → Creates Stripe Checkout Session
  → Redirects to Stripe
  → User completes payment
  → Stripe sends webhook
```

### 2. Webhook Processing

```
Stripe Webhook Event
  → POST /api/webhook
  → Verifies signature
  → Processes event:
     - invoice.payment_succeeded
       → upsertSubscription() - Adds credits
       → saveBillingHistory() - Records transaction
     - customer.subscription.deleted
       → cancelSubscription() - Sets to Free plan
```

### 3. Credit Management

```typescript
// Validate credits before action
const hasCredits = await validateCredits(userId, 100);

if (hasCredits) {
  // Deduct credits atomically
  await deductCredits(userId, 100);
  // Perform action
}
```

## 📦 Key Components

### Database Models

#### User Model
```typescript
{
  userId: string (unique),
  subscription: string (default: "Free"),
  stripeCustomerId: string,
  credits: number (default: 0),
  lastCreditAddedDate: Date
}
```

#### BillingHistory Model
```typescript
{
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  stripeInvoiceId: string (unique),
  planName: string,
  amount: number,
  creditsAdded: number,
  status: "active" | "cancelled" | "expired",
  transactionDate: Date,
  periodStart: Date,
  periodEnd: Date,
  isCurrentSubscription: boolean
}
```

### Credit Allocation

Credits are allocated based on plan:
- **Beginner**: 1,000 credits
- **Daily**: 2,000 credits
- **Creator**: 5,000 credits

Credits are added when:
- User subscribes for the first time
- Monthly subscription renews (monthly plans)
- Yearly subscription renews (yearly plans)

### Duplicate Prevention

The system prevents duplicate credit additions by:
1. Tracking processed webhook events in memory
2. Checking `lastCreditAddedDate` (within 10 minutes)
3. Verifying invoice hasn't been processed before

## 🧪 Testing

### Local Testing with Stripe CLI

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli

2. Forward webhooks to local server:
```bash
stripe listen --forward-to localhost:3000/api/webhook
```

3. Trigger test events:
```bash
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
```

### Test Credit Flow

1. Subscribe to a plan (use Stripe test card: `4242 4242 4242 4242`)
2. Check dashboard - credits should be added
3. Use "Deduct Credits" button to test deduction
4. Verify billing history is recorded

## 🔍 Troubleshooting

### Credits Not Added

1. Check webhook is receiving events:
   - Check Stripe Dashboard → Webhooks → Events
   - Check server logs for webhook events

2. Verify webhook secret is correct:
   - Check `.env.local` has correct `STRIPE_WEBHOOK_SECRET`

3. Check database:
   - Verify user exists in MongoDB
   - Check `lastCreditAddedDate` field

### Duplicate Credits

The system has built-in duplicate prevention, but if you see duplicates:

1. Check webhook event logs in Stripe Dashboard
2. Verify `processedEvents` Set is working
3. Check `lastCreditAddedDate` logic

### Subscription Not Updating

1. Verify webhook events are being received
2. Check database connection
3. Verify Stripe customer ID is correct

## 📚 API Endpoints

### POST /api/checkout
Creates a Stripe checkout session.

**Request:**
```json
{
  "price": "price_xxxxx",
  "userId": "user_123",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

### POST /api/webhook
Handles Stripe webhook events (called by Stripe).

### GET /api/user?userId=xxx
Fetches user data, credits, and billing history.

### POST /api/credits/deduct
Deducts credits from user account.

**Request:**
```json
{
  "userId": "user_123",
  "credits": 100
}
```

## 🎓 Learning Points from Creashort Implementation

1. **Atomic Operations**: Use `findOneAndUpdate` with conditions to prevent race conditions
2. **Duplicate Prevention**: Track processed events and check timestamps
3. **Error Handling**: Comprehensive error logging and graceful failures
4. **Database Indexing**: Proper indexes on `userId` and `stripeCustomerId` for performance
5. **Webhook Security**: Always verify webhook signatures
6. **Credit Validation**: Always validate before deducting to prevent negative balances

## 🔐 Security Considerations

1. **Never expose Stripe secret keys** in client-side code
2. **Always verify webhook signatures** before processing
3. **Use environment variables** for sensitive data
4. **Validate user input** before database operations
5. **Use atomic operations** for credit deduction to prevent race conditions

## 📝 Next Steps

1. Integrate with your authentication system (replace MOCK_USER_ID)
2. Customize credit amounts per plan
3. Add more subscription plans if needed
4. Implement credit purchase (one-time payments)
5. Add email notifications for subscription events
6. Create admin dashboard for managing users and credits

## 🆘 Support

For issues or questions:
1. Check Stripe Dashboard for webhook events
2. Review server logs for errors
3. Verify environment variables are set correctly
4. Test with Stripe test mode first

---

**Note**: This is a simplified implementation for learning purposes. In production, add:
- Proper authentication/authorization
- Rate limiting
- Error monitoring (Sentry, etc.)
- Database backups
- Comprehensive logging
- Unit and integration tests

