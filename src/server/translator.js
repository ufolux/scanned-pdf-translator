const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const tmp = require('tmp');
const { firefox } = require('playwright-extra')
const stealth = require('puppeteer-extra-plugin-stealth')()
const sharp = require('sharp');

// Function to convert PDF to images
const convertPDFToImages = async (pdfPath, outputDir, progressCallback) => {
  console.info('Converting PDF to images.. and save to', outputDir);
  fs.ensureDirSync(outputDir);
  const { pdf } = await import("pdf-to-img");
  try {
    const images = await pdf(pdfPath, { scale: 1 });
    let counter = 1;
    let imageCount = 0;
    for await (const image of images) {
      imageCount++;
    }

    let currentImage = 0;
    for await (const image of images) {
      currentImage++;
      const jpegPath = `${outputDir}/page${counter.toString().padStart(3, '0')}.jpeg`;
      await sharp(image).jpeg({ quality: 100, }).toFile(jpegPath);
      console.log(`Saved image: ${jpegPath}`);
      counter++;
      // Report percentage
      const percentage = (currentImage / imageCount);
      progressCallback(percentage);
    }
    console.info('Pdf converted to images. 🌟');
  } catch (error) {
    console.error('Error converting PDF to images:', error);
  }
};

// Function to translate images using Playwright and Google Translate
const translateImage = async (inLang, outLang, browser, imagePath, outputDir) => {
  const translatedImagePath = path.join(outputDir, path.basename(imagePath, path.extname(imagePath)) + '_translated.jpeg');

  try {
    const page = await browser.newPage()

    // translate image
    await page.goto(`https://translate.google.com/?sl=${inLang}&tl=${outLang}&op=images`);
    const fileInput = await page.locator('css=#yDmH0d > c-wiz > div > div.ToWKne > c-wiz > div.caTGn > c-wiz > div.iggndc > c-wiz > div > div > div > div.rlWbvd > div.gLXQIf > div.T12pLd > div:nth-child(1) > input')
    await fileInput.setInputFiles(imagePath);

    // get the translated image
    const translatedImage = await page.waitForSelector('div.CMhTbb:nth-child(2) > img:nth-child(1)');

    // Get the blob URL
    const blobUrl = await translatedImage.getAttribute('src');
    // Retrieve the blob data and convert it to a base64-encoded string
    const base64Data = await page.evaluate((blobUrl) => {
      return new Promise((resolve, reject) => {
        fetch(blobUrl)
          .then((response) => response.blob())
          .then((blob) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          })
          .catch((error) => reject(error));
      });
    }, blobUrl);

    // Save the image to a file
    const imageDataStr = base64Data.split(',')[1];
    const pngData = Buffer.from(imageDataStr, 'base64');
    await sharp(pngData)
      .jpeg({ 
        quality: 100,
      })
      .toFile(translatedImagePath)
    await page.close();
    console.info(`${path.basename(imagePath, path.extname(imagePath))} translated and saved to ${translatedImagePath} 🌟`);
  } catch (error) {
    console.error('Error translating image:', error);
  }
};

// Function to combine images into a PDF
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
        exit(1);
      }
      
      // if (imageFile.endsWith('.png')) {
      //   image = await pdfDoc.embedPng(imageBytes);
      // } else {
      //   image = await pdfDoc.embedJpg(imageBytes);
      // }
  
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

// Main function to process the PDF, with progressCallback reporting percentage (0 to 100)
const processPDF = async (inLang, outLang, pdfPath, outputDir, progressCallback = () => {}) => {
  // Create temporary directories
  const tempDir1 = tmp.dirSync({ postfix: '_images' });
  const tempDir2 = tmp.dirSync({ postfix: '_translated_images' });
  if (!fs.existsSync(outputDir)) {
    fs.mkdirpSync(outputDir);
  }
  const outputPdfPath = path.join(outputDir, path.basename(pdfPath, path.extname(pdfPath)) + '_translated.pdf');

  // Launch browser
  firefox.use(stealth);
  const browser = await firefox.launch({ headless: true, ignoreHTTPSErrors: true });
  const page = await browser.newPage();

  // Stealth test (optional)
  console.log('Testing the stealth plugin..');
  await page.goto('https://bot.sannysoft.com', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'stealth.png', fullPage: true });
  console.log('Stealth test done.');

  try {
    // Convert PDF to images and report progress (~10%)
    await convertPDFToImages(pdfPath, tempDir1.name, (progress) => progressCallback(Math.round(10 * progress)));

    const imageFiles = fs.readdirSync(tempDir1.name).filter(file => /\.(jpeg)$/i.test(file));
    const total = imageFiles.length;

    // Translate each image: progress goes from 10 to 90%
    for (const [index, imageFile] of imageFiles.entries()) {
      const imagePath = path.join(tempDir1.name, imageFile);
      await translateImage(inLang, outLang, browser, imagePath, tempDir2.name);
      const progress = 10 + Math.round((80 * (index + 1)) / total); 
      progressCallback(progress);
    }

    // Combine translated images into a PDF (final 10%)
    await combineImagesToPDF(tempDir2.name, outputPdfPath);
    progressCallback(100);
    console.info('All done! 🎉');
  } catch (error) {
    console.error('Error processing PDF:', error);
  } finally {
    fs.removeSync(tempDir1.name);
    fs.removeSync(tempDir2.name);
    console.log('Temporary folders cleaned up.');
    await browser.close();
  }

  return outputPdfPath;
};

// Export the processPDF function
module.exports = {
  processPDF
};
