import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  
  const fileNameData = await fetch("http://localhost:3001/translate", {
    method: "POST",
    body: formData,
  });

  const fileName = await fileNameData.json();
  console.log(fileName);
  // Provide link to the processed PDF
  return NextResponse.json(fileName);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const response = await fetch(`http://localhost:3001/translate?jobId=${jobId}`);
    const result = await response.json();
    return NextResponse.json(result);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? '' }, { status: 500 });
  }
}
