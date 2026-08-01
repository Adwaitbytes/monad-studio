import { NextResponse } from "next/server";
import { analyticsConfigured, getStats } from "@/lib/analytics";

/**
 * The numbers behind the product, in one request.
 *
 * Deliberately public and read-only: these are aggregate counts with no personal
 * data, and being able to open a URL and read the real figure is the whole point.
 */
export async function GET() {
  if (!analyticsConfigured()) {
    return NextResponse.json(
      { success: false, error: "Analytics is not configured. Set DATABASE_URL." },
      { status: 503 }
    );
  }

  try {
    const stats = await getStats();
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Query failed" },
      { status: 500 }
    );
  }
}
