# Stripe Credit-Based System Integration

A complete implementation of a credit-based subscription system using Stripe, Next.js, and MongoDB. This project demonstrates how to build a subscription system where users receive credits when they subscribe to plans.

## 🎯 Features

- ✅ Credit-based subscription system
- ✅ Automatic credit allocation on subscription
- ✅ Credit deduction with validation
- ✅ Billing history tracking
- ✅ Webhook handling for subscription events
- ✅ Duplicate payment prevention
- ✅ Subscription management (upgrade/downgrade/cancel)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# Stripe Keys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here

# Stripe Webhook Secrets
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Price IDs (Get these from your Stripe Dashboard)
NEXT_PUBLIC_STRIPE_MONTHLY_BEGINNER=price_xxxxx
NEXT_PUBLIC_STRIPE_MONTHLY_DAILY=price_xxxxx
NEXT_PUBLIC_STRIPE_MONTHLY_CREATOR=price_xxxxx
NEXT_PUBLIC_STRIPE_YEARLY_BEGINNER=price_xxxxx
NEXT_PUBLIC_STRIPE_YEARLY_DAILY=price_xxxxx
NEXT_PUBLIC_STRIPE_YEARLY_CREATOR=price_xxxxx

# Redirect URLs
STRIPE_REDIRECT_URL=http://localhost:3000
STRIPE_PROD_REDIRECT=https://yourdomain.com
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
stripe-integration/
├── app/
│   ├── api/
│   │   ├── checkout/          # Create Stripe checkout sessions
│   │   ├── webhook/           # Handle Stripe webhooks
│   │   ├── user/              # Get user data
│   │   └── credits/           # Credit management
│   ├── dashboard/             # User dashboard
│   ├── pricing/               # Pricing page
│   └── page.tsx               # Home page
├── actions/
│   └── user.ts                # Server actions for user/credit management
├── models/
│   ├── user.ts                # User model (credits, subscription)
│   └── billingHistory.ts      # Billing history model
├── lib/
│   └── connectDB.ts           # MongoDB connection utility
└── STRIPE_INTEGRATION_GUIDE.md # Comprehensive guide
```

## 📚 Documentation

For detailed documentation, see [STRIPE_INTEGRATION_GUIDE.md](./STRIPE_INTEGRATION_GUIDE.md)

The guide covers:
- Complete architecture overview
- Step-by-step setup instructions
- How the credit system works
- API endpoints documentation
- Testing with Stripe CLI
- Troubleshooting guide

## 🔑 Key Concepts

### Credit Allocation

When users subscribe, they receive credits based on their plan:
- **Beginner**: 1,000 credits
- **Daily**: 2,000 credits
- **Creator**: 5,000 credits

### How It Works

1. User subscribes → Stripe Checkout Session created
2. Payment succeeds → Stripe sends webhook
3. Webhook processes → Credits added to user account
4. User uses features → Credits deducted
5. Subscription renews → Credits added again

## 🧪 Testing

### Test with Stripe CLI

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Forward webhooks:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook
   ```
3. Use test card: `4242 4242 4242 4242`

## 🛠️ API Endpoints

- `POST /api/checkout` - Create checkout session
- `POST /api/webhook` - Handle Stripe webhooks
- `GET /api/user?userId=xxx` - Get user data and credits
- `POST /api/credits/deduct` - Deduct credits

## 📝 Notes

- This is a learning/demo implementation
- Replace `MOCK_USER_ID` with your actual authentication system
- Add proper error handling and logging for production
- Implement rate limiting and security measures

## 🆘 Support

For issues:
1. Check [STRIPE_INTEGRATION_GUIDE.md](./STRIPE_INTEGRATION_GUIDE.md)
2. Verify environment variables are set
3. Check Stripe Dashboard for webhook events
4. Review server logs for errors

## 📄 License

This project is for educational purposes.
