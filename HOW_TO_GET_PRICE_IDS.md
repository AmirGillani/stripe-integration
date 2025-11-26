# How to Get Stripe Price IDs

## ⚠️ Important: Product ID vs Price ID

**You MUST use Price IDs (starts with `price_`), NOT Product IDs (starts with `prod_`)**

- ❌ **Product ID**: `prod_TUgCQReBj0OkfM` - This is WRONG for checkout
- ✅ **Price ID**: `price_1ABC123xyz` - This is CORRECT for checkout

## 📋 Step-by-Step Guide

### 1. Log into Stripe Dashboard

Go to https://dashboard.stripe.com and make sure you're in **Test mode** (toggle in top right)

### 2. Navigate to Products

1. Click on **"Products"** in the left sidebar
2. You'll see a list of your products

### 3. Select Your Product

Click on the product you want to use (e.g., "Beginner", "Daily", "Creator")

### 4. Find the Price ID

1. On the product page, scroll down to the **"Pricing"** section
2. You'll see one or more prices listed (monthly, yearly, etc.)
3. Each price has:
   - **Price ID** (starts with `price_`) ← **This is what you need!**
   - Amount
   - Billing period

### 5. Copy the Price ID

1. Click on the **Price ID** (it's clickable)
2. Or copy the ID that starts with `price_`
3. It will look like: `price_1ABC123def456GHI789jkl`

### 6. Add to Environment Variables

Add the Price ID to your `.env.local` file:

```env
# For monthly plans
NEXT_PUBLIC_STRIPE_MONTHLY_BEGINNER=price_1ABC123def456GHI789jkl
NEXT_PUBLIC_STRIPE_MONTHLY_DAILY=price_1DEF456ghi789JKL012mno
NEXT_PUBLIC_STRIPE_MONTHLY_CREATOR=price_1GHI789jkl012MNO345pqr

# For yearly plans
NEXT_PUBLIC_STRIPE_YEARLY_BEGINNER=price_1JKL012mno345PQR678stu
NEXT_PUBLIC_STRIPE_YEARLY_DAILY=price_1MNO345pqr678STU901vwx
NEXT_PUBLIC_STRIPE_YEARLY_CREATOR=price_1PQR678stu901VWX234yza
```

## 🎯 Quick Visual Guide

```
Stripe Dashboard
├── Products
    └── [Your Product Name]
        └── Pricing Section
            ├── Monthly Price
            │   └── Price ID: price_1ABC123... ← COPY THIS
            └── Yearly Price
                └── Price ID: price_1DEF456... ← COPY THIS
```

## 🔍 Alternative: Using Stripe API

You can also list all prices using the Stripe API:

```bash
# Using Stripe CLI
stripe prices list

# Or using curl
curl https://api.stripe.com/v1/prices \
  -u sk_test_YOUR_SECRET_KEY:
```

## ✅ Verification

After adding the Price IDs to your `.env.local`:

1. Restart your Next.js dev server
2. Try subscribing to a plan
3. If you still get errors, double-check:
   - The Price ID starts with `price_`
   - You're using Test mode keys with Test mode prices
   - The price is active (not archived)

## 🆘 Common Mistakes

1. **Using Product ID instead of Price ID**
   - Product ID: `prod_xxx` ❌
   - Price ID: `price_xxx` ✅

2. **Mixing Test and Live Mode**
   - Test keys must use test prices
   - Live keys must use live prices

3. **Using Archived Prices**
   - Make sure the price is active
   - Archived prices won't work

4. **Wrong Environment Variable Name**
   - Make sure variable names match exactly
   - Case-sensitive!

## 📝 Example

If you created a product called "Beginner Plan" with:
- Monthly price: $23/month
- Yearly price: $14/month (billed annually)

You'll get two Price IDs:
- Monthly: `price_1ABC123monthly`
- Yearly: `price_1ABC123yearly`

Add both to your `.env.local`:
```env
NEXT_PUBLIC_STRIPE_MONTHLY_BEGINNER=price_1ABC123monthly
NEXT_PUBLIC_STRIPE_YEARLY_BEGINNER=price_1ABC123yearly
```

