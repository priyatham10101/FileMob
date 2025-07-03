# **App Name**: DocuExtract

## Core Features:

- File Upload: Upload doc and docx files.
- Content Extraction: Extract all text content from the uploaded files, including headers and footers using the 'word-extractor' npm package.
- Text Display: Display extracted text content in a formatted manner. Include document name in the display. Create distinct sections for Header, Body and Footer information, where the header and footer information is present in the source document.
- Download Text: Allow users to download the extracted content as a text file.
- AI Document Summary: AI tool for generating a short summary of the extracted document. Use a summarization model with a 'tool' to reason about when or if the summary will benefit the user.

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to convey trust and professionalism.
- Background color: Light gray (#F0F2F5), a very desaturated version of the primary, for a clean interface.
- Accent color: A bright purple (#BA68C8), an analogous color, for highlights and interactive elements to draw the eye.
- Body and headline font: 'Inter' (sans-serif) for clear and modern readability.
- Simple, professional icons for file upload and download actions.
- Clean and organized layout with clear separation of sections (upload, display, download).
- Subtle transitions for loading and content display to improve user experience.