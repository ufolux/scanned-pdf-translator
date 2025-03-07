const fs = require('fs-extra');
const path = require('path');
const tmp = require('tmp');
const sharp = require('sharp');
const OpenAI = require('openai');
const { convertPDFToImages, combineImagesToPDF } = require('./pdf-utils');

// Initialize OpenAI client for Qwen-VL model
const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
});

// Function to encode image to base64
const encodeImage = (imagePath) => {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
};

// Function to analyze image using Qwen-VL model
const analyzeImageWithQwenVL = async (imagePath, inLang, outLang) => {
  const base64Image = encodeImage(imagePath);
  
  try {
    const completion = await openai.chat.completions.create({
      model: "qwen2.5-vl-72b-instruct",
      messages: [
        {
          "role": "system", 
          "content": [{"type": "text", "text": 
            `You are a specialized OCR and translation assistant. Analyze the image to:
            1. Detect all text regions in the image
            2. Extract the text from each region (in ${inLang})
            3. Translate each text region to ${outLang}
            4. Determine the font family, font size, and background color for each region
            5. Return the results with coordinates for each text region only in JSON format`
          }]
        },
        {
          "role": "user",
          "content": [
            {
              "type": "image_url",
              "image_url": {"url": `data:image/jpeg;base64,${base64Image}`}
            },
            {
              "type": "text", 
              "text": `Please analyze this image to:
              1. Identify all text regions and their coordinates (x, y, width, height)
              2. Extract the text in ${inLang}
              3. Translate the text to ${outLang}
              4. Determine the approximate font family (serif, sans-serif, monospace, etc.), font size in pixels, and background color (in hex format) for each region
              
              Return the results ONLY in JSON format like:
              {
                "regions": [
                  {
                    "coordinates": {x: 10, y: 10, width: 100, height: 100},
                    "originalText": "text in ${inLang}",
                    "translatedText": "text in ${outLang}",
                    "fontFamily": "sans-serif",
                    "fontSize": 16,
                    "backgroundColor": "#FFFFFF"
                  }
                ]
              }`
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    // Parse the JSON response
    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error("Error analyzing image with Qwen-VL:", error);
    return { regions: [] };
  }
};

// Function to translate images using AI model
const translateImage = async (inLang, outLang, imagePath, outputDir) => {
  const translatedImagePath = path.join(outputDir, path.basename(imagePath, path.extname(imagePath)) + '_translated.jpeg');

  try {
    console.info(`Analyzing and translating ${path.basename(imagePath)}...`);

    // Get text regions and translations from Qwen-VL model
    const analysisResult = await analyzeImageWithQwenVL(imagePath, inLang, outLang);

    // Load the original image
    const image = sharp(imagePath);
    
    // Create a composite array for overlaying translated text
    let compositeArray = [];
    
    // Create a text overlay for each detected region
    for (const region of analysisResult.regions || []) {
      const { coordinates, translatedText, fontFamily, fontSize, backgroundColor } = region;
      
      // Use detected values or fallbacks
      const fontFamilyToUse = fontFamily || "Arial, sans-serif";
      const fontSizeToUse = fontSize || Math.max(14, Math.floor(coordinates.height * 0.7));
      const bgColor = backgroundColor || "#FFFFFF";
      const bgOpacity = 0.7;
      
      // Calculate text positioning and wrapping
      const padding = Math.max(5, Math.floor(fontSizeToUse / 3));
      const maxWidth = coordinates.width - (padding * 2);
      const lineHeight = Math.floor(fontSizeToUse * 1.2);
      
      // Wrap text to fit in the region
      const words = translatedText.split(' ');
      let lines = [];
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        // This is a simple estimate - in production you might want to use
        // a more sophisticated text measurement approach
        const testWidth = testLine.length * (fontSizeToUse * 0.6);
        
        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      
      // Create SVG with wrapped text
      const svgText = `
        <svg width="${coordinates.width}" height="${coordinates.height}">
          <rect width="100%" height="100%" fill="${bgColor}" fill-opacity="${bgOpacity}"/>
          ${lines.map((line, i) => `
            <text 
              x="${padding}" 
              y="${padding + fontSizeToUse + (i * lineHeight)}" 
              font-family="${fontFamilyToUse}" 
              font-size="${fontSizeToUse}px" 
              fill="black"
            >${line}</text>
          `).join('')}
        </svg>
      `;
      
      const svgBuffer = Buffer.from(svgText);
      
      // Add to composite array
      compositeArray.push({
        input: svgBuffer,
        top: coordinates.y,
        left: coordinates.x,
      });
    }
    
    // Apply text overlays to the image
    if (compositeArray.length > 0) {
      await image
        .composite(compositeArray)
        .jpeg({ quality: 100 })
        .toFile(translatedImagePath);
    } else {
      // If no text regions were detected, just copy the original image
      await image
        .jpeg({ quality: 100 })
        .toFile(translatedImagePath);
    }
    
    console.info(`${path.basename(imagePath, path.extname(imagePath))} translated and saved to ${translatedImagePath} 🌟`);
    return translatedImagePath;
  } catch (error) {
    console.error('Error translating image:', error);
    // Fallback: copy original image if translation fails
    await sharp(imagePath).toFile(translatedImagePath);
    return translatedImagePath;
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

  try {
    // Convert PDF to images and report progress (~10%)
    await convertPDFToImages(pdfPath, tempDir1.name);
    progressCallback(10);

    const imageFiles = fs.readdirSync(tempDir1.name).filter(file => /\.(jpeg)$/i.test(file));
    const total = imageFiles.length;

    // Translate each image: progress goes from 10 to 90%
    for (const [index, imageFile] of imageFiles.entries()) {
      const imagePath = path.join(tempDir1.name, imageFile);
      await translateImage(inLang, outLang, imagePath, tempDir2.name);
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
  }

  return outputPdfPath;
};

// Export the processPDF function
module.exports = {
  processPDF
};
