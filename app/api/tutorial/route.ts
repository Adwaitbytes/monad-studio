import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Tutorial slug required" },
        { status: 400 }
      );
    }

    // Map slug to file
    const tutorialFiles: Record<string, string> = {
      "erc20-token": "erc20-token.md",
      "gaming-nft": "gaming-nft.md",
    };

    const filename = tutorialFiles[slug];
    if (!filename) {
      return NextResponse.json(
        { success: false, error: "Tutorial not found" },
        { status: 404 }
      );
    }

    const tutorialPath = path.join(process.cwd(), "tutorials", filename);
    
    if (!fs.existsSync(tutorialPath)) {
      return NextResponse.json(
        { success: false, error: "Tutorial file not found" },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(tutorialPath, "utf-8");

    return NextResponse.json({
      success: true,
      content,
      slug,
      filename,
    });
  } catch (error: any) {
    console.error("Tutorial API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
