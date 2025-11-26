"use client";

import { useState } from "react";

// Mock user ID - in production, get this from your auth system
const MOCK_USER_ID = "user_123";
const MOCK_EMAIL = "user@example.com";

// Price IDs - Replace these with your actual Stripe price IDs
const PRICE_IDS = {
  monthly: {
    beginner: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_BEGINNER || "price_monthly_beginner",
    daily: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_DAILY || "price_monthly_daily",
    creator: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_CREATOR || "price_monthly_creator",
  },
  yearly: {
    beginner: process.env.NEXT_PUBLIC_STRIPE_YEARLY_BEGINNER || "price_yearly_beginner",
    daily: process.env.NEXT_PUBLIC_STRIPE_YEARLY_DAILY || "price_yearly_daily",
    creator: process.env.NEXT_PUBLIC_STRIPE_YEARLY_CREATOR || "price_yearly_creator",
  },
};

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string) => {
    setLoading(priceId);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price: priceId,
          userId: MOCK_USER_ID,
          email: MOCK_EMAIL,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to create checkout session");
        setLoading(null);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
      setLoading(null);
    }
  };

  const plans = [
    {
      name: "Beginner",
      monthlyPrice: 23,
      yearlyPrice: 14,
      credits: 1000,
      features: ["1000 credits/month", "Basic features", "Email support"],
      priceId: isYearly ? PRICE_IDS.yearly.beginner : PRICE_IDS.monthly.beginner,
    },
    {
      name: "Daily",
      monthlyPrice: 39,
      yearlyPrice: 23,
      credits: 2000,
      features: ["2000 credits/month", "All basic features", "Priority support"],
      priceId: isYearly ? PRICE_IDS.yearly.daily : PRICE_IDS.monthly.daily,
      popular: true,
    },
    {
      name: "Creator",
      monthlyPrice: 79,
      yearlyPrice: 48,
      credits: 5000,
      features: ["5000 credits/month", "All features", "24/7 support", "API access"],
      priceId: isYearly ? PRICE_IDS.yearly.creator : PRICE_IDS.monthly.creator,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-gray-600 mb-8">
            Select the perfect plan for your needs
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm ${!isYearly ? "font-semibold" : "text-gray-500"}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isYearly ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isYearly ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className={`text-sm ${isYearly ? "font-semibold" : "text-gray-500"}`}>
              Yearly
            </span>
            {isYearly && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Save up to 40%
              </span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-lg shadow-lg p-8 ${
                plan.popular ? "ring-2 ring-blue-500 scale-105" : ""
              }`}
            >
              {plan.popular && (
                <div className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full inline-block mb-4">
                  Most Popular
                </div>
              )}
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {plan.name}
              </h2>
              <div className="mb-4">
                <span className="text-4xl font-bold text-gray-900">
                  €{isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                </span>
                <span className="text-gray-600">/month</span>
                {isYearly && (
                  <div className="text-sm text-gray-500 mt-1">
                    Billed annually (€{plan.yearlyPrice * 12}/year)
                  </div>
                )}
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-600">
                    <svg
                      className="w-5 h-5 text-green-500 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan.priceId)}
                disabled={loading === plan.priceId}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                  plan.popular
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                } ${loading === plan.priceId ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {loading === plan.priceId ? "Loading..." : "Subscribe"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

