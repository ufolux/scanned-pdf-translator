"use client";
import { langOptions } from "@/utils/lang-utils";
import { useState, useEffect } from "react";

export default function UploadPage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [downloadLink, setDownloadLink] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [statusId, setStatusId] = useState(-1);
  const [isDragging, setIsDragging] = useState(false);
  const [srcLang, setSrcLang] = useState("zh-CN");
  const [dstLang, setDstLang] = useState("en");
  const [buttonDisabled, setButtonDisabled] = useState(false);

  // Create an object URL for the PDF file and cleanup when the file changes
  useEffect(() => {
    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl("");
    }
  }, [pdfFile]);

  // Poll the progress endpoint every second when jobId is set
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (jobId) {
      intervalId = setInterval(async () => {
        const res = await fetch(`/translate/api?jobId=${jobId}`);
        if (res.ok) {
          const data = await res.json();
          setProgress(data.progress);
          setStatus(data.status);
          setStatusId(data.statusId);
          if (data.fileName) {
            setDownloadLink(`${window.location.href}download/api?fileName=${data.fileName}`);
            clearInterval(intervalId);
            setButtonDisabled(false);
          }
          if (data.status === "failed") {
            clearInterval(intervalId);
            setButtonDisabled(false);
          }
        } else {
          clearInterval(intervalId);
        }
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId]);

  useEffect(() => {
    if (statusId === 2 || statusId === 3) {
      setButtonDisabled(false);
    }
  }, [statusId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPdfFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      alert("Please upload a PDF file");
      return;
    }

    setButtonDisabled(true);
    const formData = new FormData();
    formData.append("inputPdf", pdfFile);
    formData.append("srcLang", srcLang);
    formData.append("dstLang", dstLang);

    const res = await fetch("/translate/api", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const { jobId } = await res.json();
      setJobId(jobId);
      setStatus("in-progress");
    } else {
      setButtonDisabled(false);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        setPdfFile(file);
        setDownloadLink("");
      } else {
        alert("Please upload a PDF file");
      }
      e.dataTransfer.clearData();
    }
  };

  // Helper to convert file size to KB
  const getFileSizeInKB = (file: File) => {
    return Math.round(file.size / 1024);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-300 to-purple-200">
      <div className="flex flex-col items-center gap-6 p-10">
        <h1 className="text-3xl font-semibold mt-20 text-white">Upload & Translate Your PDF</h1>
        <form onSubmit={handleUpload} className="flex flex-col items-center gap-4">
          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`cursor-pointer border-dashed border-2 ${
              isDragging ? "border-green-600 bg-green-100" : "border-green-500 bg-green-50"
            } text-green-800 font-medium px-6 py-6 rounded shadow-md flex flex-col items-center justify-center w-96`}
          >
            {pdfFile ? (
              <div className="text-center flex flex-1 justify-between w-full">
                <span>{pdfFile.name}</span>
                <span>{getFileSizeInKB(pdfFile)} KB</span>
              </div>
            ) : (
              <span>Drag & drop your PDF here or click to choose</span>
            )}
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {/* Language Selection */}
          <div className="flex gap-4">
            <div className="flex flex-col">
              <label className="mb-1 text-white font-semibold">From</label>
              <select
                value={srcLang}
                onChange={(e) => setSrcLang(e.target.value)}
                className="px-3 py-2 rounded border"
              >
                {langOptions.map((lang) => (
                  <option value={lang.langCode} key={lang.langCode}>
                    {lang.langName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-white font-semibold">To</label>
              <select
                value={dstLang}
                onChange={(e) => setDstLang(e.target.value)}
                className="px-3 py-2 rounded border"
              >
                {langOptions.map((lang) => (
                  <option value={lang.langCode} key={lang.langCode}>
                    {lang.langName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="bg-blue-500 text-white px-6 py-3 rounded shadow-md hover:bg-blue-600 disabled:bg-slate-400 w-72 font-semibold" type="submit" disabled={buttonDisabled}>
            Translate
          </button>
        </form>

        {jobId && (
          <div className="mt-4 w-full flex flex-col items-center gap-4">
            <p className="mb-2 font-semibold text-white">
              Translation {status} {statusId === 2 && '🎉'}
            </p>
            <div className="w-full flex justify-center gap-2">
              <div className="relative w-full h-4 rounded-full bg-gray-200 overflow-hidden flex flex-row">
                <div
                  style={{ width: `${progress}%` }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                />
              </div>
              <span className="text-sm text-gray-600">{progress}%</span>
            </div>
          </div>
        )}

        {/* Preview Thumbnails */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-xl text-center font-semibold mb-3 border-b pb-2">Original PDF</h2>
            <div className="overflow-hidden rounded-md">
              {previewUrl ? (
                <object data={previewUrl} type="application/pdf" width="100%" height="400">
                  <div className="flex flex-col items-center justify-center h-full bg-gray-100">
                    <p className="text-gray-700">PDF preview is unavailable</p>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 underline text-blue-500 hover:text-blue-700"
                    >
                      Open PDF
                    </a>
                  </div>
                </object>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] bg-gray-100">
                  <p className="text-gray-700">No PDF uploaded yet</p>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-xl text-center font-semibold mb-3 border-b pb-2">Translated PDF</h2>
            <div className="overflow-hidden rounded-md">
              {downloadLink ? (
                <object data={downloadLink} type="application/pdf" width="100%" height="400">
                  <div className="flex flex-col items-center justify-center h-full bg-gray-100">
                    <p className="text-gray-700">PDF preview is unavailable</p>
                    <a
                      href={downloadLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 underline text-blue-500 hover:text-blue-700"
                    >
                      Open PDF
                    </a>
                  </div>
                </object>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] bg-gray-100">
                  <p className="text-gray-700">No translated PDF available</p>
                </div>
              )}
            </div>
          </div>
        </div>
        {downloadLink && (
          <div className="mt-6 mb-14">
            <a
              href={`${downloadLink}&download=true`}
              download
              target="_blank"
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg transition-colors duration-300"
            >
              Download Translated PDF
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
