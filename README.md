# Scanned PDF Translator

<p align="center">
  <img src="https://github.com/user-attachments/assets/75693577-b1f2-464e-8fe3-576354b64c9c" width="200" height="200" alt="Scanned PDF Translator Logo"/>
</p>

A powerful tool for translating scanned PDFs using Google Image Translate. Built with Playwright, it seamlessly processes PDF pages through Google's visual translation service and compiles them back into a translated PDF document.

## Features

- 🌍 **Multi-language Support** - Translate between any languages supported by Google Translate
- 📄 **Batch Processing** - Translate multiple PDFs at once with simple scripts
- 🖥️ **Dual Interface** - Choose between CLI for automation or web UI for convenience
- 🐳 **Docker Ready** - Quick deployment with pre-built Docker images

## Quick Start

### Command Line Interface

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Run translation:**
   ```bash
   node src/server/cli.js [fromLang] [toLang] [filePath] [outputDir]
   ```

3. **Example:**
   ```bash
   node src/server/cli.js zh-CN en ./example.pdf ./output
   ```

#### Finding Language Codes

Language codes can be found in [Google Translate](https://translate.google.com/?sl=zh-CN&tl=en&op=translate)'s URL parameters:

```
https://translate.google.com/?sl=zh-CN&tl=en&op=translate
```

- `sl` = source language (fromLang)
- `tl` = target language (toLang)

#### Batch Translation

Use this shell script to translate multiple files:

```bash
SRC_DIR="srcDir"
DEST_DIR="destDir"

find "$SRC_DIR" -type f | while read -r file; do
  echo "Processing: $file"
  node cli.js zh-CN en "$file" "$DEST_DIR"
done
```

### Web UI - Local Development

```bash
npm run install:all
npm run start:dev
```

Then open `http://localhost:3010` in your browser.

### Web UI - Docker Deployment

```bash
docker pull ufolux001/scanned-pdf-translator:latest
docker run -d -p 3000:3000 ufolux001/scanned-pdf-translator
```

Then open `http://localhost:3000` in your browser.

## Screenshots

### Translation Interface
<img width="1825" alt="Translation interface showing source PDF" src="https://github.com/user-attachments/assets/bef8f2da-e5d9-4ef0-8821-53b6b0920ead" />

### Translated Result
<img width="1828" alt="Translated PDF output" src="https://github.com/user-attachments/assets/4119ad74-a933-465d-9811-c2f9f6445052" />

## How It Works

1. Converts PDF pages to images
2. Uploads each image to Google Image Translate via Playwright automation
3. Captures the translated images
4. Combines translated images back into a PDF

## Requirements

- Node.js (version specified in package.json)
- npm or yarn
- Docker (optional, for containerized deployment)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Note:** This tool relies on Google Translate's image translation service. Please ensure your usage complies with Google's Terms of Service.
