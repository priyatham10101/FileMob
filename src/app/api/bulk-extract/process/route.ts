import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import WordExtractor from 'word-extractor';
import pdf from 'pdf-parse';

const allowedExtensions = ['doc', 'docx', 'pdf', 'md', 'txt'];

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
  const nodeBuffer = await fs.readFile(filePath);
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
        statuses[file] = 'failed';
        logs.push(`${file}: Skipped (unsupported extension)`);
        continue;
      }
      
      const inputFilePath = path.join(inputPath, file);
      const outputFileName = file.replace(/\.[^.]+$/, '.txt');
      const outputFilePath = path.join(outputPath, outputFileName);
      
      try {
        // Always process the file (no duplicate checking)
        const text = await extractText(inputFilePath, ext);
        const cleanedText = advancedCleanText(text);
        if (!cleanedText || cleanedText.length < 5) {
          statuses[file] = 'failed';
          logs.push(`${file}: Failed - Could not extract valid UTF-8 text or file is empty after cleaning.`);
          continue;
        }
        await fs.writeFile(outputFilePath, cleanedText, 'utf-8');
        statuses[file] = 'processed';
        logs.push(`${file}: Processed successfully.`);
      } catch (err) {
        statuses[file] = 'failed';
        logs.push(`${file}: Failed - ${(err as Error).message}`);
      }
    }
    
    return NextResponse.json({ statuses, logs });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
} 