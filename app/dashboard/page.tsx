"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// Mock user ID - in production, get this from your auth system
const MOCK_USER_ID = "user_123";

interface UserData {
  user: {
    userId: string;
    subscription: string;
    credits: number;
    stripeCustomerId?: string;
  } | null;
  credits: number;
  billingHistory: any[];
}

export default function DashboardPage() {
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deducting, setDeducting] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch(`/api/user?userId=${MOCK_USER_ID}`);
      const userData = await response.json();
      setData(userData);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeductCredits = async (amount: number) => {
    setDeducting(true);
    try {
      const response = await fetch("/api/credits/deduct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: MOCK_USER_ID,
          credits: amount,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`Successfully deducted ${amount} credits!`);
        fetchUserData(); // Refresh data
      } else {
        alert(result.error || "Failed to deduct credits");
      }
    } catch (error) {
      console.error("Error deducting credits:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setDeducting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Manage your account and credits</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Current Plan Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Current Plan
            </h2>
            <div className="mb-4">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {data?.user?.subscription || "Free"}
              </div>
              <div className="text-gray-600">
                {data?.user?.subscription === "Free"
                  ? "No active subscription"
                  : "Active subscription"}
              </div>
            </div>
            <Link
              href="/pricing"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {data?.user?.subscription === "Free"
                ? "Upgrade Plan"
                : "Manage Subscription"}
            </Link>
          </div>

          {/* Credits Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Available Credits
            </h2>
            <div className="mb-4">
              <div className="text-4xl font-bold text-green-600 mb-2">
                {data?.credits?.toLocaleString() || 0}
              </div>
              <div className="text-gray-600">Credits remaining</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDeductCredits(10)}
                disabled={deducting}
                className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {deducting ? "Processing..." : "Deduct 10"}
              </button>
              <button
                onClick={() => handleDeductCredits(100)}
                disabled={deducting}
                className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {deducting ? "Processing..." : "Deduct 100"}
              </button>
            </div>
          </div>
        </div>

        {/* Billing History */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Billing History
          </h2>
          {data?.billingHistory && data.billingHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Plan</th>
                    <th className="text-left py-3 px-4">Amount</th>
                    <th className="text-left py-3 px-4">Credits Added</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.billingHistory.map((item: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-4">
                        {new Date(item.transactionDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">{item.planName}</td>
                      <td className="py-3 px-4">
                        {(item.amount / 100).toFixed(2)} {item.currency.toUpperCase()}
                      </td>
                      <td className="py-3 px-4">{item.creditsAdded}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            item.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-600 text-center py-8">
              No billing history yet.{" "}
              <Link href="/pricing" className="text-blue-600 hover:underline">
                Subscribe to a plan
              </Link>{" "}
              to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

