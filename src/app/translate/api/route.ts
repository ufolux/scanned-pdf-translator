import { NextResponse } from "next/server";
import { processPDF, LanguageCode } from "@/lib/translator";
import {
  getJobState,
  setJobState,
  initJobState,
  generateJobId,
} from "@/lib/states";
import fs from "fs-extra";
import tmp from "tmp";
import path from "path";
import { ExpireIn30Mins } from "@/lib/redis";

export async function POST(request: Request) {
  const jobId = generateJobId();

  // Initialize job status in the in-memory store
  initJobState(jobId);

  try {
    const formData = await request.formData();
    const inputPdf = formData.get("inputPdf") as File;
    const srcLang = formData.get("srcLang") as LanguageCode;
    const dstLang = formData.get("dstLang") as LanguageCode;

    if (!inputPdf || !srcLang || !dstLang) {
      throw new Error("Missing required fields");
    }

    // Create a temporary file to save the uploaded PDF
    const tempInputDir = tmp.dirSync({ postfix: "input" });
    const tempOutputDir = tmp.dirSync({ postfix: "output" });

    // Convert file to Buffer and write to temp file
    const pdfBuffer = Buffer.from(await inputPdf.arrayBuffer());
    const inputPdfPath = path.join(tempInputDir.name, jobId + ".pdf");
    fs.writeFileSync(inputPdfPath, pdfBuffer);

    // Process PDF in the background
    (async () => {
      try {
        // Call processPDF with the correct parameters
        const translatedPdfPath = await processPDF(
          srcLang,
          dstLang,
          inputPdfPath,
          tempOutputDir.name,
          (progress) => {
            getJobState(jobId).then((jobState) => {
              if (jobState) {
                setJobState(jobId, {
                  ...jobState,
                  progress,
                });
              }
            });
          }
        );

        // Store the PDF data and update status
        const fileName = `${jobId}_translated.pdf`;
        const jobState = await getJobState(jobId);
        if (!jobState) {
          throw new Error("Job state not found");
        }
        await setJobState(jobId, {
          ...jobState,
          fileName,
          pdfPath: translatedPdfPath,
          status: "completed",
          statusId: 2,
        });

        // Schedule removal after 30 minutes
        setTimeout(() => {
          fs.removeSync(translatedPdfPath);
        }, ExpireIn30Mins * 1000);
      } catch (error) {
        const jobState = await getJobState(jobId);
        if (!jobState) {
          throw new Error("Job state not found");
        }
        setJobState(jobId, {
          ...jobState,
          status: "failed",
          statusId: 3,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        // Clean up temporary files
        fs.removeSync(inputPdfPath);
      }
    })();

    // Return immediately with the job ID
    return NextResponse.json({ jobId, status: "in progress", statusId: 1 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }
    const jobState = await getJobState(jobId);
    if (!jobState!) {
      return NextResponse.json(
        { error: "jobId is required or not found" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ...jobState, pdfPath: undefined });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
