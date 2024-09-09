const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const tmp = require('tmp');
const { firefox } = require('playwright-extra')
const stealth = require('puppeteer-extra-plugin-stealth')()
const sharp = require('sharp');

// Function to convert PDF to images
const convertPDFToImages = async (pdfPath, outputDir) => {
  console.info('Converting PDF to images.. and save to', outputDir);
  fs.ensureDirSync(outputDir);
  const { pdf } = await import("pdf-to-img");
  try {
    const images = await pdf(pdfPath, { scale: 1 });
    let counter = 1;
    for await (const image of images) {
      const jpegPath = `${outputDir}/page${counter.toString().padStart(3, '0')}.jpeg`;
      await sharp(image).jpeg({ quality: 90, }).toFile(jpegPath);
      console.log(`Saved image: ${jpegPath}`);
      counter++;
    }
    console.info('Pdf converted to images. 🌟');
  } catch (error) {
    console.error('Error converting PDF to images:', error);
  }
};

// Function to translate images using Playwright and Google Translate
const translateImage = async (browser, imagePath, outputDir) => {
  const translatedImagePath = path.join(outputDir, path.basename(imagePath, path.extname(imagePath)) + '_translated.jpeg');

  try {
    const page = await browser.newPage()

    // translate image
    await page.goto('https://translate.google.com/?sl=zh-CN&tl=zh-TW&op=images');

    const fileInput = page.getByRole('textbox', { name: 'Browse your files' });
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
        quality: 90,
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

// Main function to process the PDF
const processPDF = async (pdfPath, outputDir) => {
  const tempDir1 = tmp.dirSync({
    postfix: '_images',
  });
  const tempDir2 = tmp.dirSync({
    postfix: '_translated_images',
  });
  if (!fs.existsSync(outputDir)) {
    fs.mkdirpSync(outputDir);
  }
  const outputPdfPath = path.join(outputDir, path.basename(pdfPath, path.extname(pdfPath)) + '_translated.pdf');

  firefox.use(stealth);
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage()

  // Enable the stealth plugin and test it
  console.log('Testing the stealth plugin..')
  await page.goto('https://bot.sannysoft.com', { waitUntil: 'networkidle' })
  await page.screenshot({ path: 'stealth.png', fullPage: true })
  console.log('All done, check the screenshot. ✨')

  try {
    await convertPDFToImages(pdfPath, tempDir1.name);

    const imageFiles = fs.readdirSync(tempDir1.name).filter(file => /\.(jpeg)$/i.test(file));
    for (const imageFile of imageFiles) {
      const imagePath = path.join(tempDir1.name, imageFile);
      await translateImage(browser, imagePath, tempDir2.name);
    }
    console.info('All images translated. 🌟');
    console.info('Combining images into PDF.. 📚');
    await combineImagesToPDF(tempDir2.name, outputPdfPath);
    console.info('All done! 🎉');
  } catch (error) {
    console.error('Error processing PDF:', error);
  } finally {
    fs.removeSync(tempDir1.name);
    fs.removeSync(tempDir2.name);
    console.log('Temporary folders cleaned up.');
    await browser.close();
  }
};

// Parse command-line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: node translator.js <path-to-pdf> <output-dir>');
  process.exit(1);
}

const pdfPath = args[0];
const outputDir = args[1];
processPDF(pdfPath, outputDir);
