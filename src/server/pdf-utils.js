const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

/**
 * Converts a PDF file to JPEG images
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} outputDir - Directory to save the images
 * @returns {Promise<void>}
 */
const convertPDFToImages = async (pdfPath, outputDir) => {
  console.info('Converting PDF to images.. and save to', outputDir);
  fs.ensureDirSync(outputDir);
  const { pdf } = await import("pdf-to-img");
  try {
    const images = await pdf(pdfPath, { scale: 1 });
    let counter = 1;
    for await (const image of images) {
      const jpegPath = `${outputDir}/page${counter.toString().padStart(3, '0')}.jpeg`;
      await sharp(image).jpeg({ quality: 100, }).toFile(jpegPath);
      console.log(`Saved image: ${jpegPath}`);
      counter++;
    }
    console.info('Pdf converted to images. 🌟');
  } catch (error) {
    console.error('Error converting PDF to images:', error);
  }
};

/**
 * Combines JPEG images into a PDF file
 * @param {string} imagesDir - Directory containing the images
 * @param {string} outputPdfPath - Path to save the combined PDF
 * @returns {Promise<void>}
 */
const combineImagesToPDF = async (imagesDir, outputPdfPath) => {
  const pdfDoc = await PDFDocument.create();
  const imageFiles = fs.readdirSync(imagesDir).filter(file => /\.(jpeg)$/i.test(file));

  try {
    for (const imageFile of imageFiles) {
      const imagePath = path.join(imagesDir, imageFile);
      const imageBytes = fs.readFileSync(imagePath);
      let image;
      try {
        image = await pdfDoc.embedJpg(imageBytes);
      } catch (error) {
        console.error('Error embedding image:', error);
        process.exit(1);
      }
      
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    }
  
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPdfPath, pdfBytes);
    console.log(`PDF successfully created at ${outputPdfPath}`);
  } catch (error) {
    console.error('Error creating PDF:', error);
  }
};

module.exports = {
  convertPDFToImages,
  combineImagesToPDF
};