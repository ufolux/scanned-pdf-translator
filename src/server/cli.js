const { processPDF } = require('./translator');

// Parse command-line arguments
const args = process.argv.slice(2);
if (args.length !== 4) {
  console.error('Usage: node translator.js <src-lang> <dst-lang> <path-to-pdf> <output-dir>');
  process.exit(1);
}

const inLang = args[0];
const outLang = args[1];
const pdfPath = args[2];
const outputDir = args[3];
processPDF(inLang, outLang, pdfPath, outputDir);