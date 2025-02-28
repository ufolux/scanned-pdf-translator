# Scanned PDFs Translator

This is a tool to translate scanned PDFs using Google Image Translate. It uses Playwright to interact with Google Image Translate and combines the translated images into a PDF file.

## Quick start

```
docker build -t scanned-pdf-translator .
docker run -d -p 3000:3000 scanned-pdf-translator
```

Then open `http://localhost:3000` in your browser and enjoy.

## Pre-requisites

## Installation

## Usage

```
node src/translator.js <src-lang> <dst-lang> <input.pdf> <output.dir>
```

`<src-lang>` and `<dst-lang>` should be the language code. For example, `en` for English, `ja` for Japanese, `zh-CN` for Simplified Chinese, etc. You can refer the code on google translate.

`<input.pdf>` is the path to the PDF file to be translated.

`<output.dir>` is the directory where the translated PDF will be saved.

## Example
### Berfore
<img width="587" alt="image" src="https://github.com/user-attachments/assets/223fda27-4977-4f62-b3d1-6fc33f4ed298">

### After
<img width="572" alt="image" src="https://github.com/user-attachments/assets/b8d877a7-b455-4ab8-9915-23722fa0d06c">


