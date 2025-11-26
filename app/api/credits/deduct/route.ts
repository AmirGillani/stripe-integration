import { NextResponse } from "next/server";
import { deductCredits, validateCredits } from "@/actions/user";

export async function POST(req: Request) {
  try {
    const { userId, credits } = await req.json();

    if (!userId || !credits) {
      return NextResponse.json(
        { error: "Missing userId or credits" },
        { status: 400 }
      );
    }

    // Validate credits first
    const hasEnoughCredits = await validateCredits(userId, credits);

    if (!hasEnoughCredits) {
      return NextResponse.json(
        { error: "Insufficient credits", success: false },
        { status: 400 }
      );
    }

    // Deduct credits
    const success = await deductCredits(userId, credits);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Failed to deduct credits", success: false },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error deducting credits:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}

