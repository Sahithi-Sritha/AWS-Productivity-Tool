import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const lambdaUrl = process.env.AWS_LAMBDA_URL;
    if (!lambdaUrl) {
      return NextResponse.json(
        { error: "AWS Lambda URL not configured" },
        { status: 500 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "guest";
    const date = searchParams.get("date") || null;

    // Construct Lambda URL with query params for GET /history
    const url = new URL(lambdaUrl);
    url.pathname = "/history";
    url.searchParams.set("userId", userId);
    if (date) url.searchParams.set("date", date);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Lambda returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
