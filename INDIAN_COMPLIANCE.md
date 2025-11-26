# Indian Compliance for Stripe Transactions

## 🇮🇳 Indian Export Regulations

As per Indian regulations, export transactions (payments from customers outside India) require:
- ✅ Customer name
- ✅ Customer billing address

## ✅ Solution Implemented

The checkout session has been configured to comply with Indian regulations:

### 1. Required Billing Address Collection

```typescript
billing_address_collection: "required"
```

This ensures customers **must** provide their billing address during checkout.

### 2. Customer Update Configuration

```typescript
customer_update: {
  address: "auto", // Automatically update customer address from checkout
  name: "auto",    // Automatically update customer name from checkout
}
```

This automatically saves the customer's name and address to their Stripe customer record.

### 3. Customer Email

```typescript
customer_email: email
```

The customer's email is explicitly set in the checkout session.

## 🧪 Testing

When testing with the test card `4242 4242 4242 4242`:

1. **You will be prompted to enter:**
   - Full name
   - Billing address (street, city, state, postal code, country)

2. **This is required** - you cannot skip these fields

3. **Test Address Example:**
   - Name: Test User
   - Address: 123 Test Street
   - City: Test City
   - State: Test State
   - Postal Code: 12345
   - Country: United States (or any country)

## 📋 What Happens

1. Customer enters name and address in Stripe Checkout
2. Stripe validates the information
3. Customer completes payment
4. Customer name and address are automatically saved to their Stripe customer record
5. Webhook processes the payment and adds credits

## 🔍 Verification

After a successful transaction, you can verify in Stripe Dashboard:

1. Go to **Customers** → Select the customer
2. Check that:
   - ✅ Name is present
   - ✅ Billing address is present
   - ✅ Email is present

## ⚠️ Important Notes

- This is **required by law** for Indian businesses processing international payments
- You **cannot** disable this requirement
- The checkout form will **force** customers to enter this information
- This applies to **all** customers, not just Indian customers

## 📚 Additional Resources

- [Stripe India Exports Documentation](https://stripe.com/docs/india-exports)
- [Stripe Checkout Address Collection](https://stripe.com/docs/payments/checkout/collect-billing-address)

## 🛠️ If You Still Get Errors

1. **Make sure you're using the latest code** - The checkout session now requires billing address
2. **Clear browser cache** - Old checkout sessions might be cached
3. **Check Stripe Dashboard** - Verify your account settings allow international payments
4. **Test with a fresh checkout session** - Create a new checkout session after the code update

## ✅ Current Configuration

The checkout is now configured with:
- ✅ `billing_address_collection: "required"`
- ✅ `customer_email: email`
- ✅ `customer_update: { address: "auto", name: "auto" }`

This ensures full compliance with Indian export regulations.

