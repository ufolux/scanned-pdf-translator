import fs from 'fs-extra';
import path from 'path';
import { PDFDocument, scale } from 'pdf-lib';
import { Browser, Page } from 'playwright';
import sharp from 'sharp';
import tmp from 'tmp';
// Replace the ESM import of stealth
// import stealth from 'puppeteer-extra-plugin-stealth';
// With CommonJS require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stealth = require('puppeteer-extra-plugin-stealth')();
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { firefox } = require('playwright-extra');


// Progress callback type
export type ProgressCallback = (percentage: number) => void;

// Language code type for input/output languages
export type LanguageCode = string;

// Function to convert PDF to images
const convertPDFToImages = async (
  pdfPath: string, 
  outputDir: string, 
  progressCallback: ProgressCallback
): Promise<void> => {
  console.info('Converting PDF to images.. and save to', outputDir);
  fs.ensureDirSync(outputDir);
  
  try {
    // Use pdf-img-convert - a cross-platform Node.js solution without browser dependencies
    const { default: pdf2pic } = await import('pdf2pic');
    const { fromBuffer } = pdf2pic;
    
    // Get the total number of pages using pdf-lib
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    const options = {
      quality: 100,
      density: 300,
      saveFilename: "page",
      savePath: outputDir,
      format: "jpeg",
      preserveAspectRatio: true,
    };
    const convert = await fromBuffer(pdfBuffer, options);
    // Convert each page to an image
    for (let i = 1; i <= pageCount; i++) {
      const outputPath = path.join(outputDir, `page${i.toString().padStart(3, '0')}.jpeg`);
      
      try {
        const result = await convert(i);
        if (result && result.path) {
          // Rename if needed to match our expected format
          if (result.path !== outputPath) {
            fs.renameSync(result.path, outputPath);
          }
          console.log(`Saved image: ${outputPath}`);
        }
      } catch (pageError) {
        console.error(`Error converting page ${i}:`, pageError);
        throw pageError;
      }
      
      // Report percentage
      const percentage = i / pageCount;
      progressCallback(percentage);
    }
    
    console.info('PDF converted to images. 🌟');
  } catch (error) {
    console.error('Error converting PDF to images with pdf-img-convert:', error);
    
    // Fallback to pdf-lib and pdf2pic approach if the primary method fails
    try {
      const pdfBytes = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();
      
      // Try using pdf2pic which is also Node.js native
      try {
        // Fix the import to properly use pdf2pic
        const pdf2pic = await import('pdf2pic');
        // Access the fromPath function correctly
        const { fromPath } = pdf2pic;
        
        if (!fromPath) {
          throw new Error('Could not find fromPath function in pdf2pic module');
        }
        
        const options = {
          density: 300,
          saveFilename: "page",
          savePath: outputDir,
          format: "jpeg",
        };
        
        const convert = fromPath(pdfPath, options);
        
        for (let i = 1; i <= pageCount; i++) {
          // Use proper page number and options format
          await convert(i, { responseType: "image" });
          
          // Report percentage
          const percentage = i / pageCount;
          progressCallback(percentage);
        }
        
        console.info('PDF converted to images using pdf2pic. 🌟');
      } catch (pdf2picError) {
        console.error('pdf2pic conversion failed:', pdf2picError);
        
        // Final fallback using pdf-lib and sharp
        try {
          for (let i = 0; i < pageCount; i++) {
            // Create a single-page PDF
            const pdfDocSingle = await PDFDocument.create();
            const [copiedPage] = await pdfDocSingle.copyPages(pdfDoc, [i]);
            pdfDocSingle.addPage(copiedPage);
            
            const pdfBytesSingle = await pdfDocSingle.save();
            const tempFilePath = path.join(outputDir, `temp_page_${i}.pdf`);
            fs.writeFileSync(tempFilePath, pdfBytesSingle);
            
            try {
              // Use pdf-image which has fewer dependencies
              const pdfImageModule = await import('pdf-image');
              // Access the constructor properly - it's likely in the default export or directly exported
              const PDFImage = pdfImageModule.PDFImage;
              
              if (!PDFImage) {
                throw new Error('Could not load PDFImage from pdf-image module');
              }
              
              const pdfImage = new PDFImage(tempFilePath, {
                convertOptions: {
                  '-density': '300',
                  '-quality': '100'
                }
              });
              
              const imagePath = await pdfImage.convertPage(0);
              const outputPath = path.join(outputDir, `page${(i + 1).toString().padStart(3, '0')}.jpeg`);
              
              // Copy image to final location with proper name
              if (fs.existsSync(imagePath)) {
                fs.copyFileSync(imagePath, outputPath);
                console.log(`Saved image: ${outputPath}`);
              }
              
              // Clean up temp file
              if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
              }
              
              // Report percentage
              const percentage = (i + 1) / pageCount;
              progressCallback(percentage);
            } catch (pdfImageError) {
              console.error('pdf-image conversion failed:', pdfImageError);
              // Clean up temp file if it exists
              if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
              }
              throw pdfImageError;
            }
          }
        } catch (finalFallbackError) {
          console.error('Final PDF conversion method failed:', finalFallbackError);
          throw new Error('All PDF to image conversion methods failed');
        }
      }
    } catch (fallbackError) {
      console.error('Fallback PDF conversion also failed:', fallbackError);
      throw new Error('Failed to convert PDF to images');
    }
  }
};

// Function to translate images using Playwright and Google Translate
const translateImage = async (
  inLang: LanguageCode, 
  outLang: LanguageCode, 
  browser: Browser, 
  imagePath: string, 
  outputDir: string
): Promise<void> => {
  const translatedImagePath = path.join(outputDir, path.basename(imagePath, path.extname(imagePath)) + '_translated.jpeg');

  try {
    const page: Page = await browser.newPage();

    // translate image
    await page.goto(`https://translate.google.com/?sl=${inLang}&tl=${outLang}&op=images`);
    
    // Use a more reliable selector for the file input
    // Wait for the input to be available
    await page.screenshot({ path: 'translate.png', fullPage: true });
    const fileInput = await page.locator('css=#yDmH0d > c-wiz > div > div.ToWKne > c-wiz > div.caTGn > c-wiz > div.iggndc > c-wiz > div > div > div > div.rlWbvd > div.gLXQIf > div.T12pLd > div:nth-child(1) > input')
    await fileInput.setInputFiles(imagePath);

    // get the translated image
    const translatedImage = await page.waitForSelector('div.CMhTbb:nth-child(2) > img:nth-child(1)');

    // Get the blob URL
    const blobUrl = await translatedImage.getAttribute('src');
    // Retrieve the blob data and convert it to a base64-encoded string
    const base64Data = await page.evaluate((blobUrl) => {
      if (!blobUrl) {
        throw new Error('Blob URL is null or undefined');
      }
      return new Promise<string>((resolve, reject) => {
        fetch(blobUrl)
          .then((response) => response.blob())
          .then((blob) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
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
      .toFile(translatedImagePath);
    await page.close();
    console.info(`${path.basename(imagePath, path.extname(imagePath))} translated and saved to ${translatedImagePath} 🌟`);
  } catch (error) {
    console.error('Error translating image:', error);
    throw error; // Re-throw to handle in the caller function
  }
};

// Function to combine images into a PDF
const combineImagesToPDF = async (
  imagesDir: string, 
  outputPdfPath: string
): Promise<void> => {
  const pdfDoc = await PDFDocument.create();
  const imageFiles = fs.readdirSync(imagesDir)
    .filter(file => /\.(jpeg)$/i.test(file))
    .sort(); // Ensure images are sorted correctly

  try {
    for (const imageFile of imageFiles) {
      const imagePath = path.join(imagesDir, imageFile);
      const imageBytes = fs.readFileSync(imagePath);
      let image;
      try {
        image = await pdfDoc.embedJpg(imageBytes);
      } catch (error) {
        console.error(`Error embedding image ${imagePath}:`, error);
        throw error;
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
    throw error;
  }
};

// Main function to process the PDF, with progressCallback reporting percentage (0 to 100)
const processPDF = async (
  inLang: LanguageCode, 
  outLang: LanguageCode, 
  pdfPath: string, 
  outputDir: string, 
  progressCallback: ProgressCallback = () => {}
): Promise<string> => {
  // Create temporary directories
  const tempDir1 = tmp.dirSync({ postfix: '_images' });
  const tempDir2 = tmp.dirSync({ postfix: '_translated_images' });
  if (!fs.existsSync(outputDir)) {
    fs.mkdirpSync(outputDir);
  }
  const outputPdfPath = path.join(outputDir, path.basename(pdfPath, path.extname(pdfPath)) + '_translated.pdf');

  // Launch browser
  firefox.use(stealth);
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();

  // Stealth test (optional)
  console.log('Testing the stealth plugin..');
  await page.goto('https://bot.sannysoft.com', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'stealth.png', fullPage: true });
  console.log('Stealth test done.');

  try {
    // Convert PDF to images and report progress (~10%)
    await convertPDFToImages(pdfPath, tempDir1.name, (progress) => progressCallback(Math.round(10 * progress)));

    const imageFiles = fs.readdirSync(tempDir1.name)
      .filter(file => /\.(jpeg)$/i.test(file))
      .sort(); // Ensure images are processed in order
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
    throw error;
  } finally {
    try {
      fs.removeSync(tempDir1.name);
      fs.removeSync(tempDir2.name);
      console.log('Temporary folders cleaned up.');
    } catch (cleanupError) {
      console.error('Error cleaning up temporary folders:', cleanupError);
    }
    await browser.close();
  }

  return outputPdfPath;
};

// Export the processPDF function
export {
  processPDF,
};