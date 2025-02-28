const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { processPDF } = require("./translator");
const app = express();
const port = 3001;

// In-memory store for job progress and status
// Each job key will hold an object: { progress, status, downloadLink?, error? }
const progressMap = {};

// Utility to generate a simple job ID
const generateJobId = () => Math.random().toString(36).substr(2, 9);

// Middleware to parse JSON bodies
app.use(express.json());

// Set up multer for file uploads
const upload = multer({ dest: "uploads/" });
const outputDir = path.join(__dirname, "output");
fs.removeSync(outputDir);

var options = {
  dotfiles: "ignore",
  etag: false,
  extensions: ["pdf"],
  index: false,
  maxAge: "1d",
  redirect: false,
  setHeaders: function (res) {
    res.set("x-timestamp", Date.now());
  }
};

app.use("/output", express.static(outputDir, options));

// Endpoint to handle translation requests
app.post("/translate", upload.single("inputPdf"), (req, res) => {
  const jobId = generateJobId();

  // Initialize job status in the in-memory store
  progressMap[jobId] = {
    progress: 0,
    status: "in progress",
    statusId: 1,
    downloadLink: null
  };

  let inputPdf = "";
  try {
    const { srcLang, dstLang } = req.body;
    inputPdf = req.file.path;

    // Launch PDF processing in background
    processPDF(srcLang, dstLang, inputPdf, outputDir, (progress) => {
      progressMap[jobId].progress = progress;
    })
      .then((outputPdfPath) => {
        const downloadLink = `${req.protocol}://${req.get(
          "host"
        )}/output/${outputPdfPath.split("/").at(-1)}`;
        progressMap[jobId].downloadLink = downloadLink;
        progressMap[jobId].status = "completed";
        progressMap[jobId].statusId = 2;
        // Schedule removal after 30 minutes
        setTimeout(() => {
          fs.removeSync(outputPdfPath);
        }, 30 * 60 * 1000);
      })
      .catch((error) => {
        progressMap[jobId].status = "failed";
        progressMap[jobId].statusId = 3;
        progressMap[jobId].error = error.message;
      })
      .finally(() => {
        // Clean up the uploaded file
        fs.removeSync(inputPdf);
      });

    // Return immediately with the job id and initial status
    res.json({ jobId, status: "in progress", statusId: 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to check translation progress
app.get("/translate", (req, res) => {
  const jobId = req.query.jobId;
  if (!jobId || !progressMap[jobId]) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json(progressMap[jobId]);
});

app.listen(port, () => {
  console.log(
    `Server is running on port ${port}\nAccess at http://localhost:3001/`
  );
});
