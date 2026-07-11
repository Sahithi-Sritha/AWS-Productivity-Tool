import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { tasks } = await req.json();

    if (!tasks || typeof tasks !== "string") {
      return NextResponse.json(
        { error: "Invalid input: tasks must be a string" },
        { status: 400 }
      );
    }

    const lambdaUrl = process.env.AWS_LAMBDA_URL;
    if (!lambdaUrl) {
      return NextResponse.json(
        { error: "AWS Lambda URL not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(lambdaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks }),
    });

    if (!response.ok) {
      throw new Error(`Lambda returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error calling Lambda:", error);
    return NextResponse.json(
      { error: "Failed to prioritize tasks" },
      { status: 500 }
    );
  }
}
