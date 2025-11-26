# Complete Transaction Flow - Function Call Sequence

This document shows the **exact order** of function calls during a subscription transaction.

## 🔄 Complete Transaction Flow

### **PHASE 1: User Initiates Subscription** (Frontend)

```
1. User clicks "Subscribe" button
   ↓
2. handleSubscribe() in app/pricing/page.tsx
   ↓
3. fetch("/api/checkout", { method: "POST", body: { price, userId, email } })
```

---

### **PHASE 2: Checkout API Processing** (Backend)

```
4. POST handler in app/api/checkout/route.ts
   ↓
5. Parse request body: { price, userId, email }
   ↓
6. connectDB() - Connect to MongoDB
   ↓
7. validateCustomer(userId, email) - Called from checkout route
   │
   ├─→ UserModel.findOne({ userId }) - Check if user exists in DB
   │
   ├─→ If user NOT found:
   │   ├─→ new UserModel({ userId, subscription: "Free", credits: 0 })
   │   └─→ user.save() - Create new user
   │
   ├─→ If user.stripeCustomerId exists:
   │   └─→ stripe.customers.retrieve(stripeCustomerId) - Get existing customer
   │
   └─→ If customer doesn't exist:
       ├─→ stripe.customers.create({ email }) - Create new Stripe customer
       └─→ UserModel.updateOne({ userId }, { stripeCustomerId }) - Save customer ID
   ↓
8. stripe.subscriptions.list({ customer, status: "active" }) - Check existing subscriptions
   ↓
9. Validate price ID:
   ├─→ Check if price starts with "price_"
   └─→ stripe.prices.retrieve(price) - Verify price exists
   ↓
10. stripe.checkout.sessions.create({ ... }) - Create Stripe checkout session
    ↓
11. Return { url: stripeSession.url } to frontend
```

---

### **PHASE 3: User Completes Payment** (Stripe)

```
12. User redirected to Stripe Checkout page
    ↓
13. User enters card details (4242 4242 4242 4242)
    ↓
14. User enters billing address (required for Indian compliance)
    ↓
15. User clicks "Subscribe" on Stripe page
    ↓
16. Stripe processes payment
    ↓
17. Stripe sends webhook event to /api/webhook
```

---

### **PHASE 4: Webhook Processing** (Backend)

```
18. POST handler in app/api/webhook/route.ts
    ↓
19. stripe.webhooks.constructEvent(body, signature, webhookSecret) - Verify signature
    ↓
20. Check for duplicate event (processedEvents.has(eventKey))
    ↓
21. Process event based on eventType:
```

#### **Event: checkout.session.completed**

```
22. case "checkout.session.completed":
    ↓
23. Extract session.metadata.previousSubscriptionIdz
    ↓
24. If previous subscriptions exist:
    ├─→ Wait 1 second (delay)
    └─→ For each subscription ID:
        └─→ stripe.subscriptions.cancel(subscriptionId) - Cancel old subscriptions
```

#### **Event: invoice.payment_succeeded** (MAIN CREDIT ADDITION)

```
25. case "invoice.payment_succeeded":
    ↓
26. Extract invoice data:
    ├─→ invoice.id
    ├─→ invoice.amount_paid
    ├─→ invoice.subscription (subscription ID)
    └─→ invoice.customer (customer ID)
    ↓
27. stripe.subscriptions.retrieve(subscriptionId) - Get full subscription details
    ↓
28. Extract priceId: subscription.items.data[0].price.id
    ↓
29. getPlanDetailsByPriceId(priceId) - Map price ID to plan name
    │
    └─→ Returns: { title: "Beginner", isYearly: false }
    ↓
30. Check for duplicate invoice (processedEvents.has(invoiceKey))
    ↓
31. upsertSubscription(subscription, planDetails.title) - Called from webhook
    │
    ├─→ connectDB() - Ensure DB connection
    │
    ├─→ UserModel.findOne({ stripeCustomerId: customerId }) - Find user by Stripe customer ID
    │
    ├─→ Calculate creditsToAdd from PLAN_CREDITS:
    │   ├─→ "Beginner" → 1000 credits
    │   ├─→ "Daily" → 2000 credits
    │   └─→ "Creator" → 5000 credits
    │
    ├─→ Check for duplicate credit addition:
    │   ├─→ Check lastCreditAddedDate (within 10 minutes)
    │   └─→ Check if subscription already matches plan
    │
    ├─→ If NOT duplicate:
    │   └─→ UserModel.updateOne({ stripeCustomerId }, {
    │       $set: { subscription: plan, lastCreditAddedDate: new Date() },
    │       $inc: { credits: creditsToAdd }
    │   }) - ADD CREDITS HERE! 🎉
    │
    └─→ Return actualCreditsAdded
    ↓
32. saveBillingHistory(invoice, subscription, planName, creditsAdded) - Called from webhook
    │
    ├─→ connectDB() - Ensure DB connection
    │
    ├─→ getPlanDetailsByPriceId(priceId) - Get plan details again
    │
    ├─→ BillingHistoryModel.findOne({ stripeInvoiceId: invoice.id }) - Check for duplicate
    │
    ├─→ If NOT duplicate:
    │   ├─→ BillingHistoryModel.updateMany({ stripeCustomerId }, 
    │   │       { isCurrentSubscription: false }) - Mark old subscriptions as inactive
    │   │
    │   ├─→ UserModel.findOne({ stripeCustomerId }) - Get user to find userId
    │   │
    │   └─→ new BillingHistoryModel({ ... }) - Create billing record
    │       ├─→ userId
    │       ├─→ stripeCustomerId
    │       ├─→ stripeSubscriptionId
    │       ├─→ stripeInvoiceId (unique)
    │       ├─→ planName
    │       ├─→ amount: invoice.amount_paid
    │       ├─→ creditsAdded: expectedCreditsForPlan
    │       ├─→ status: "active"
    │       ├─→ transactionDate: new Date(invoice.created * 1000)
    │       ├─→ periodStart: new Date(subscription.current_period_start * 1000)
    │       ├─→ periodEnd: new Date(subscription.current_period_end * 1000)
    │       └─→ isCurrentSubscription: true
    │
    └─→ billingRecord.save() - Save to database
    ↓
33. Mark invoice as processed: processedEvents.add(invoiceKey)
    ↓
34. Return NextResponse.json({ received: true })
```

#### **Event: customer.subscription.created**

```
35. case "customer.subscription.created":
    ↓
36. Extract subscription data
    ↓
37. If subscription.status === "active" or "trialing":
    ├─→ getPlanDetailsByPriceId(priceId)
    └─→ upsertSubscription(subscription, planDetails.title) - Same as step 31
```

#### **Event: customer.subscription.updated**

```
38. case "customer.subscription.updated":
    ↓
39. If subscription.status === "active":
    ├─→ getPlanDetailsByPriceId(priceId)
    └─→ upsertSubscription(subscription, planDetails.title) - Same as step 31
```

#### **Event: customer.subscription.deleted**

```
40. case "customer.subscription.deleted":
    ↓
41. BillingHistoryModel.updateMany({ stripeSubscriptionId }, 
        { status: "cancelled", isCurrentSubscription: false })
    ↓
42. Wait 2 seconds (delay to allow other events to process)
    ↓
43. stripe.subscriptions.list({ customer, status: "active" }) - Check for other subscriptions
    ↓
44. If no active subscriptions:
    └─→ cancelSubscription(customerId) - Called from webhook
        └─→ UserModel.updateOne({ stripeCustomerId }, { subscription: "Free" })
```

---

### **PHASE 5: User Views Dashboard** (Frontend)

```
45. User navigates to /dashboard
    ↓
46. useEffect() in app/dashboard/page.tsx
    ↓
47. fetchUserData() - Called from dashboard
    ↓
48. fetch("/api/user?userId=xxx")
    ↓
49. GET handler in app/api/user/route.ts
    ↓
50. fetchUser(userId) - Called from API route
    │
    ├─→ connectDB()
    │
    └─→ UserModel.findOne({ userId }).lean() - Get user data
    ↓
51. fetchCredits(userId) - Called from API route
    │
    ├─→ connectDB()
    │
    └─→ fetchUser(userId) - Reuses fetchUser function
    ↓
52. getBillingHistory(userId) - Called from API route
    │
    ├─→ connectDB()
    │
    ├─→ BillingHistoryModel.find({ userId }).sort({ transactionDate: -1 }).lean()
    │
    └─→ If no results, try by stripeCustomerId
    ↓
53. Return { user, credits, billingHistory } to frontend
    ↓
54. Dashboard displays:
    ├─→ Current plan: user.subscription
    ├─→ Available credits: credits
    └─→ Billing history table
```

---

### **PHASE 6: User Uses Credits** (Optional)

```
55. User clicks "Deduct Credits" button
    ↓
56. handleDeductCredits(amount) in app/dashboard/page.tsx
    ↓
57. fetch("/api/credits/deduct", { method: "POST", body: { userId, credits } })
    ↓
58. POST handler in app/api/credits/deduct/route.ts
    ↓
59. validateCredits(userId, credits) - Called from API route
    │
    ├─→ connectDB()
    │
    ├─→ UserModel.findOne({ userId }).lean()
    │
    └─→ Return (user.credits || 0) >= credits
    ↓
60. If has enough credits:
    └─→ deductCredits(userId, credits) - Called from API route
        │
        ├─→ connectDB()
        │
        └─→ UserModel.findOneAndUpdate(
            { userId, credits: { $gte: credits } },  // Only if enough credits
            { $inc: { credits: -credits } },           // Atomic decrement
            { new: true }                             // Return updated doc
        ) - DEDUCT CREDITS HERE! 💸
    ↓
61. Return { success: true } to frontend
    ↓
62. Dashboard refreshes and shows updated credits
```

---

## 📊 Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER CLICKS SUBSCRIBE                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: handleSubscribe()                                │
│  → POST /api/checkout                                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: POST /api/checkout                                │
│  1. validateCustomer()                                      │
│  2. Check existing subscriptions                            │
│  3. Validate price ID                                       │
│  4. stripe.checkout.sessions.create()                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  User redirected to Stripe Checkout                         │
│  → Enters card & address                                    │
│  → Completes payment                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Stripe sends webhook: invoice.payment_succeeded            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: POST /api/webhook                                 │
│  1. Verify webhook signature                                │
│  2. Check for duplicates                                    │
│  3. upsertSubscription() ← ADDS CREDITS                     │
│  4. saveBillingHistory() ← RECORDS TRANSACTION              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  User views dashboard                                       │
│  → GET /api/user                                            │
│  → fetchUser(), fetchCredits(), getBillingHistory()         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Functions Summary

### **Checkout Flow Functions** (in order):
1. `handleSubscribe()` - Frontend
2. `POST /api/checkout` - API route
3. `validateCustomer()` - Creates/retrieves customer
4. `stripe.checkout.sessions.create()` - Creates checkout

### **Webhook Flow Functions** (in order):
1. `POST /api/webhook` - Webhook handler
2. `stripe.webhooks.constructEvent()` - Verify signature
3. `stripe.subscriptions.retrieve()` - Get subscription
4. `getPlanDetailsByPriceId()` - Map price to plan
5. `upsertSubscription()` - **ADDS CREDITS** ⭐
6. `saveBillingHistory()` - **SAVES TRANSACTION** ⭐

### **Dashboard Flow Functions** (in order):
1. `fetchUserData()` - Frontend
2. `GET /api/user` - API route
3. `fetchUser()` - Get user data
4. `fetchCredits()` - Get credits
5. `getBillingHistory()` - Get billing history

### **Credit Deduction Functions** (in order):
1. `handleDeductCredits()` - Frontend
2. `POST /api/credits/deduct` - API route
3. `validateCredits()` - Check if enough credits
4. `deductCredits()` - **DEDUCTS CREDITS** ⭐

---

## ⚡ Critical Points

1. **Credits are added in `upsertSubscription()`** - Called from webhook
2. **Transaction is saved in `saveBillingHistory()`** - Called from webhook
3. **Credits are deducted in `deductCredits()`** - Called from API route
4. **All database operations use `connectDB()` first** - Ensures connection
5. **Duplicate prevention happens at multiple levels** - Webhook events, invoices, credit additions

---

## 🎯 Most Important Functions

1. **`upsertSubscription()`** - The function that actually adds credits when payment succeeds
2. **`saveBillingHistory()`** - The function that records the transaction
3. **`deductCredits()`** - The function that uses credits (atomic operation)
4. **`validateCustomer()`** - Ensures user and Stripe customer exist

