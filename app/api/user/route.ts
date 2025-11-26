import { NextResponse } from "next/server";
import { fetchUser, fetchCredits, getBillingHistory } from "@/actions/user";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const user = await fetchUser(userId);
    const credits = await fetchCredits(userId);
    const billingHistory = await getBillingHistory(userId);

    return NextResponse.json({
      user,
      credits,
      billingHistory,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

