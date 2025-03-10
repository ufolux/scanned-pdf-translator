import { NextResponse } from "next/server";
import { getJobState } from "@/lib/states";
import fs from "fs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const forceDownload = searchParams.get("download") === "true";

    let job = null;
    if (!jobId || !(job = await getJobState(jobId))) {
      return NextResponse.json(
        { error: "jobId is required or not found" },
        { status: 400 }
      );
    }
    
    // Check if the job is completed and has PDF data
    if (job.status !== "completed" || !job.pdfPath || !job.fileName) {
      return NextResponse.json(
        { error: "PDF not ready or not found" },
        { status: 404 }
      );
    }
    
    // Read the PDF file from the file system
    const pdfData = fs.readFileSync(job.pdfPath);
    
    // Set appropriate headers
    const headers = new Headers();
    
    if (forceDownload) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${job.fileName}"`
      );
    } else {
      headers.set(
        "Content-Disposition",
        `inline; filename="${job.fileName}"`
      );
    }
    
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Length", pdfData.length.toString());
    
    // Add cache control for better performance
    headers.set("Cache-Control", "public, max-age=300"); // Cache for 5 minutes

    // Return the PDF data directly
    return new NextResponse(pdfData, { 
      status: 200,
      headers 
    });
  } catch (error) {
    console.error("Error serving PDF file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
