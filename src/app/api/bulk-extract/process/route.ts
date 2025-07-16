import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import WordExtractor from 'word-extractor';
import pdf from 'pdf-parse';
const parseRTF = require('rtf-parser');


const allowedExtensions = ['doc', 'docx', 'pdf', 'md', 'txt', 'rtf'];

// Utility to robustly decode buffer as UTF-8, replacing invalid bytes
function decodeUtf8WithReplacement(buffer: Buffer): string {
  // Use TextDecoder with 'replacement' for invalid bytes
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  } catch {
    // Fallback: replace all non-printable chars
    return buffer.toString('utf-8').replace(/[^\x20-\x7E\n]+/g, '');
  }
}


async function extractText(filePath: string, ext: string): Promise<string> {
  const nodeBuffer = await fsp.readFile(filePath);
  switch (ext) {
    case 'doc':
    case 'docx': {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(nodeBuffer);
      const contentParts = [
        doc.getHeaders(),
        doc.getBody(),
        doc.getFooters(),
        doc.getTextboxes(),
        doc.getAnnotations(),
      ];
      return contentParts.filter(part => part && part.trim()).join('\n\n');
    }
    case 'pdf': {
      const data = await pdf(nodeBuffer);
      return data.text;
    }
    case 'md':
    case 'txt': {
      // Robustly decode as UTF-8, replacing invalid bytes
      return decodeUtf8WithReplacement(nodeBuffer);
    }
    case 'rtf': {
      // Use rtf-parser to extract text from RTF
      return new Promise((resolve) => {
        const stream = fs.createReadStream(filePath);
        parseRTF.stream(stream, (err: any, doc: any) => {
          if (err || !doc) return resolve('');
          // Extract plain text from the RTFDocument structure
          function extractPlainTextFromDoc(doc: any): string {
            if (!doc) return '';
            if (Array.isArray(doc.content)) {
              return doc.content.map(extractPlainTextFromParagraph).join('\n');
            }
            return '';
          }
          function extractPlainTextFromParagraph(paragraph: any): string {
            if (!paragraph || !Array.isArray(paragraph.content)) return '';
            return paragraph.content.map((span: any) => span.value || '').join('');
          }
          resolve(extractPlainTextFromDoc(doc));
        });
      });
    }
    default:
      throw new Error('Unsupported file type: ' + ext);
  }
}

// Add advancedCleanText utility
function advancedCleanText(text: string): string {
  let cleaned = text.replace(/\r\n/g, '\n');
  // Remove non-ASCII/non-printable characters
  cleaned = cleaned.replace(/[^\x20-\x7E\n]+/g, '');
  // Remove Unicode replacement character ()
  cleaned = cleaned.replace(/\uFFFD/g, '');
  // Trim each line but preserve single line breaks
  cleaned = cleaned
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
  cleaned = cleaned.replace(/ {2,}/g, ' ');
  cleaned = cleaned.replace(/^(Professional summary|Work Experience|Skills|Education Credential|Languages Known:|Personal Profile:)/gim, '\n$1\n');
  cleaned = cleaned.replace(/^[•\-\*]/gm, '-');
  cleaned = cleaned.replace(/^\s*[-–—]+\s*$/gm, '');
  cleaned = cleaned.replace(/\.{2,}/g, '.');
  // After all cleaning, collapse multiple blank lines to a single blank line
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

// Utility to clean file names by removing non-ASCII characters (preserve extension)
function cleanFileName(fileName: string): string {
  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
  const base = fileName.replace(new RegExp(ext + '$'), '');
  // Remove non-ASCII chars from base, collapse spaces, trim
  const cleanedBase = base.replace(/[^\x20-\x7E]+/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
  return cleanedBase + ext;
}

export async function POST(req: NextRequest) {
  try {
    const { inputPath, outputPath, files } = await req.json();
    if (!inputPath || !outputPath || !Array.isArray(files)) {
      return NextResponse.json({ error: 'Invalid input.' }, { status: 400 });
    }
    const statuses: Record<string, 'processed' | 'failed'> = {};
    const logs: string[] = [];
    
    for (const file of files) {
      const ext = file.split('.').pop()?.toLowerCase();
      if (!ext || !allowedExtensions.includes(ext)) {
        statuses[cleanFileName(file)] = 'failed';
        logs.push(`${cleanFileName(file)}: Skipped (unsupported extension)`);
        continue;
      }
      
      const inputFilePath = path.join(inputPath, file);
      const outputFileName = cleanFileName(file.replace(/\.[^.]+$/, '.txt'));
      const outputFilePath = path.join(outputPath, outputFileName);
      
      try {
        // Always process the file (no duplicate checking)
        const text = await extractText(inputFilePath, ext);
        const cleanedText = advancedCleanText(text);
        if (!cleanedText || cleanedText.length < 5) {
          statuses[cleanFileName(file)] = 'failed';
          logs.push(`${cleanFileName(file)}: Failed - Could not extract valid UTF-8 text or file is empty after cleaning.`);
          continue;
        }
        await fsp.writeFile(outputFilePath, cleanedText, 'utf-8');
        statuses[cleanFileName(file)] = 'processed';
        logs.push(`${cleanFileName(file)}: Processed successfully.`);
      } catch (err) {
        statuses[cleanFileName(file)] = 'failed';
        logs.push(`${cleanFileName(file)}: Failed - ${(err as Error).message}`);
      }
    }
    
    return NextResponse.json({ statuses, logs });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
} 