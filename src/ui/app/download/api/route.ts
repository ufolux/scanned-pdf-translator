import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");
    const forceDownload = searchParams.get("download") === "true";

    console.info('fileName: ', fileName);

    if (!fileName) {
      return NextResponse.json(
        { error: "downloadLink is required" },
        { status: 400 }
      );
    }

    const response = await fetch(`http://localhost:3001/output/${fileName}`);
    if (!response.ok) {
      throw new Error("Failed to fetch file.");
    }
    
    const fileBuffer = Buffer.from(await response.arrayBuffer());
    
    // Set appropriate headers
    const headers = new Headers();
    
    // Only set as attachment if forceDownload is true, otherwise display inline
    if (forceDownload) {
      headers.set(
        "Content-Disposition",
        `attachment; filename=${fileName}`
      );
    } else {
      headers.set(
        "Content-Disposition",
        `inline; filename=${fileName}`
      );
    }
    
    headers.set(
      "Content-Type",
      response.headers.get("Content-Type") || "application/pdf"
    );

    return new NextResponse(fileBuffer, { headers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "An error occurred" },
      { status: 500 }
    );
  }
}