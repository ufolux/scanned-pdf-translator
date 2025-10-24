# Scanned PDFs Translator

<p align="center">
  <img src="https://github.com/user-attachments/assets/75693577-b1f2-464e-8fe3-576354b64c9c" width="200" height="200" alt="logo"/>
</p>


This is a tool to translate scanned PDFs using Google Image Translate. It uses Playwright to interact with Google Image Translate and combines the translated images into a PDF file.

## Quick start

### Command line interface

```
npm run install:all
cd src/server
node cli.js [fromLang] [toLang] [filePath] [outputDir]
```

For example

```
node cli.js zh-CN en ~/Documents/example.pdf ~/Documents/output
```

You can find the fromLang and toLang codes in the URL parameters of Google Translate.
After selecting the languages, the URL will look like this:

```
https://translate.google.com/?sl=zh-CN&tl=en&op=translate
```

Here, sl represents the source language (fromLang), and tl represents the target language (toLang).

### UI Local server

```
npm run install:all
npm run start:dev
```

Then you can open `http://localhost:3010` in your browser and enjoy.

### UI Docker

```
docker pull ufolux001/scanned-pdf-translator:latest
docker run -d -p 3000:3000 scanned-pdf-translator
```

Then open `http://localhost:3000` in your browser and enjoy.


## Example

<img width="1825" alt="image" src="https://github.com/user-attachments/assets/bef8f2da-e5d9-4ef0-8821-53b6b0920ead" />



<img width="1828" alt="image" src="https://github.com/user-attachments/assets/4119ad74-a933-465d-9811-c2f9f6445052" />
