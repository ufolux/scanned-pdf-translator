import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const downloadLink = searchParams.get("downloadLink");

    if (!downloadLink) {
      return NextResponse.json({ error: "downloadLink is required" }, { status: 400 });
    }

    const response = await fetch(downloadLink);
    const result = await response.blob();
    return NextResponse.blob(result);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? '' }, { status: 500 });
  }
}
