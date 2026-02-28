import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

// GET /api/qr?url=https://...&size=300
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const size = parseInt(searchParams.get("size") ?? "300", 10);

  if (!url) {
    return NextResponse.json({ error: "url parameter is required" }, { status: 400 });
  }

  const pngBuffer = await QRCode.toBuffer(url, {
    type: "png",
    width: size,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  return new NextResponse(new Uint8Array(pngBuffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
