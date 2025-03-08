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

// Function to safely parse JSON with error recovery
const safeJsonParse = (jsonString) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing JSON response:", error.message);
    
    // Attempt to fix common JSON format issues
    let fixedJson = jsonString;
    
    // Fix missing quotes around property names
    fixedJson = fixedJson.replace(/(\{|\,)\s*(\w+)\s*\:/g, '$1"$2":');
    
    // Fix single quotes used instead of double quotes
    fixedJson = fixedJson.replace(/'/g, '"');
    
    // Fix trailing commas in arrays and objects
    fixedJson = fixedJson.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');
    
    // Fix missing commas between properties
    fixedJson = fixedJson.replace(/"\s*\{/g, '",{');
    
    // Fix unescaped quotes in strings
    fixedJson = fixedJson.replace(/([^\\])"/g, '$1\\"');
    
    // Try to parse the fixed JSON
    try {
      return JSON.parse(fixedJson);
    } catch (secondError) {
      console.error("Failed to fix JSON:", secondError.message);
      
      // Last resort: use a more forgiving JSON parser
      try {
        // Use Function constructor as a last resort (be careful with this approach)
        // This is less secure but more forgiving for malformed JSON
        const jsonFix = new Function('return ' + fixedJson)();
        console.warn("Used fallback JSON parser - result may be incomplete");
        return jsonFix;
      } catch (finalError) {
        console.error("All JSON parsing methods failed");
        // Return a minimal valid structure
        return { regions: [] };
      }
    }
  }
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
            `You are a specialized OCR and translation assistant that excels at visual analysis. Your task is to:
            1. Precisely detect all text regions containing ${inLang} text ONLY (ignore any existing ${outLang} text)
            2. Extract the text from each region (in ${inLang})
            3. Translate each text region to ${outLang}
            4. Determine the font family, font size, and exact background color for each region
            5. Return structured results with accurate coordinates and visual properties in JSON format`
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
              "text": `Carefully analyze this image to:
              
              1. Identify text regions containing ${inLang} text ONLY (ignore any existing ${outLang} text)
              2. Extract the text in ${inLang}
              3. Translate the text to ${outLang}
              4. Determine for each text region:
                 - Font family (serif, sans-serif, monospace, handwritten, etc.)
                 - Font size in pixels
                 - Background color (in hex format)
                   - IMPORTANT: Be precise about the background color - sample multiple pixels to determine the dominant color
                   - If the text appears on a colorful or complex background, use the most appropriate color for readability
              
              Return ONLY a JSON object with this exact structure - ensure it is valid JSON:
              {
                "regions": [
                  {
                    "coordinates": {"x": 10, "y": 10, "width": 100, "height": 100},
                    "originalText": "text in ${inLang}",
                    "translatedText": "text in ${outLang}",
                    "fontFamily": "sans-serif",
                    "fontSize": 16,
                    "backgroundColor": "#F5F5F5"
                  }
                ]
              }`
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    const responseContent = completion.choices[0].message.content;
    console.log("Qwen-VL response:", responseContent);

    // Use our safe JSON parse function
    const result = safeJsonParse(responseContent);
    
    // Validate result structure
    if (!result || !Array.isArray(result.regions)) {
      console.warn("Invalid result structure, initializing empty regions array");
      result.regions = [];
    }
    
    // Additional filtering to remove any potential duplicates (where original text is not in source language)
    if (inLang.toLowerCase().includes('zh') || inLang.toLowerCase().includes('chinese')) {
      // For Chinese to English translation, filter out regions where originalText doesn't contain Chinese characters
      const hasChineseChar = (text) => /[\u4E00-\u9FFF]/.test(text);
      result.regions = result.regions.filter(region => hasChineseChar(region.originalText));
    }
    
    // Ensure all required properties exist in each region
    result.regions = result.regions.map(region => {
      return {
        coordinates: region.coordinates || { x: 0, y: 0, width: 100, height: 30 },
        originalText: region.originalText || "",
        translatedText: region.translatedText || "",
        fontFamily: region.fontFamily || "sans-serif",
        fontSize: region.fontSize || 16,
        backgroundColor: region.backgroundColor || "#FFFFFF"
      };
    });
    
    return result;
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
    const imageMetadata = await image.metadata();
    const imageWidth = imageMetadata.width;
    const imageHeight = imageMetadata.height;
    
    // Create a composite array for overlaying translated text
    let compositeArray = [];
    
    // Create a text overlay for each detected region
    for (const region of analysisResult.regions || []) {
      const { coordinates, translatedText, fontFamily, fontSize, backgroundColor } = region;
      
      // Expand the text region to better accommodate translations
      // Increase height by 20% and width by 10%
      const expandedCoordinates = {
        x: Math.max(0, coordinates.x - Math.floor(coordinates.width * 0.05)),
        y: Math.max(0, coordinates.y - Math.floor(coordinates.height * 0.1)),
        width: Math.min(imageWidth - coordinates.x, Math.floor(coordinates.width * 1.1)),
        height: Math.min(imageHeight - coordinates.y, Math.floor(coordinates.height * 1.2))
      };
      
      // Use detected values or fallbacks
      const fontFamilyToUse = fontFamily || "Arial, sans-serif";
      const fontSizeToUse = fontSize || Math.max(14, Math.floor(expandedCoordinates.height * 0.6));

      // More sophisticated background color handling
      let bgColor = backgroundColor || "#FFFFFF";
      // If the background is white or very close to white, slightly off-white to avoid pure white
      if (bgColor === "#FFFFFF" || bgColor === "#FFF" || bgColor === "#FEFEFE") {
        // Check if we're dealing with a page that might be off-white
        if (imagePath.toLowerCase().includes("book") || imagePath.toLowerCase().includes("paper")) {
          bgColor = "#FAFAFA"; // Slightly off-white for book/paper pages
        }
      }

      const bgOpacity = 0.85; // Slightly increased opacity for better readability
      
      // Calculate text positioning and wrapping
      const padding = Math.max(5, Math.floor(fontSizeToUse / 3));
      const maxWidth = expandedCoordinates.width - (padding * 2);
      const lineHeight = Math.floor(fontSizeToUse * 1.2);
      
      // Estimate how much vertical space we need for the text
      const estimatedCharWidth = fontSizeToUse * 0.6;
      const avgCharsPerLine = Math.max(1, Math.floor(maxWidth / estimatedCharWidth));
      const estimatedLines = Math.ceil(translatedText.length / avgCharsPerLine);
      
      // Make sure the height can accommodate the estimated text height
      const requiredHeight = (estimatedLines * lineHeight) + (padding * 2);
      if (requiredHeight > expandedCoordinates.height) {
        expandedCoordinates.height = Math.min(imageHeight - expandedCoordinates.y, requiredHeight);
      }
      
      // Wrap text to fit in the region
      const words = translatedText.split(' ');
      let lines = [];
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
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
        <svg width="${expandedCoordinates.width}" height="${expandedCoordinates.height}">
          <rect width="100%" height="100%" fill="${bgColor}" fill-opacity="${bgOpacity}" rx="3" ry="3"/>
          ${lines.map((line, i) => `
            <text 
              x="${padding}" 
              y="${padding + fontSizeToUse + (i * lineHeight)}" 
              font-family="${fontFamilyToUse}" 
              font-size="${fontSizeToUse}px" 
              fill="black"
              font-weight="medium"
            >${line}</text>
          `).join('')}
        </svg>
      `;
      
      const svgBuffer = Buffer.from(svgText);
      
      // Add to composite array
      compositeArray.push({
        input: svgBuffer,
        top: expandedCoordinates.y,
        left: expandedCoordinates.x,
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
