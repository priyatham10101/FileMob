'use server';

import WordExtractor from 'word-extractor';
import { summarizeDocument } from '@/ai/flows/summarize-document';

const pdf = require('pdf-parse');

export interface ExtractedContent {
  filename: string;
  fullText: string;
}

interface FormState {
  error?: string | null;
  extractedContent?: ExtractedContent | null;
}

export async function extractTextFromFile(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const file = formData.get('file') as File;

  if (!file || file.size === 0) {
    return { ...prevState, error: 'Please select a file to upload.' };
  }
  
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['doc', 'docx', 'pdf', 'md', 'txt'];

  if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
    return { ...prevState, error: 'Invalid file type. Please upload a PDF, DOC, DOCX, TXT, or MD file.' };
  }
  
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return { ...prevState, error: 'File is too large. Maximum size is 5MB.'};
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const nodeBuffer = Buffer.from(arrayBuffer);
    let fullText = '';

    switch (fileExtension) {
        case 'doc':
        case 'docx': {
            const extractor = new WordExtractor();
            const doc = await extractor.extract(nodeBuffer);
            fullText = doc.getBody();
            break;
        }
        case 'pdf': {
            const data = await pdf(nodeBuffer);
            fullText = data.text;
            break;
        }
        case 'md':
        case 'txt': {
            fullText = await file.text();
            break;
        }
        default: {
            return { ...prevState, error: `Unsupported file type: ${fileExtension}` };
        }
    }


    return {
      extractedContent: {
        filename: file.name,
        fullText: fullText || "No content extracted.",
      },
      error: null,
    };
  } catch (err) {
    console.error(err);
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    return { ...prevState, error: `Failed to extract text: ${errorMessage}` };
  }
}

export async function getSummary(text: string): Promise<{ summary: string, error?: null } | { error: string, summary?: null }> {
    if (!text || text.trim().length < 50) { 
        return { error: "There is not enough content in the document to generate a summary." };
    }
    try {
        const result = await summarizeDocument({ text });
        return { summary: result.summary };
    } catch (error) {
        console.error("AI summarization failed:", error);
        return { error: "The AI failed to generate a summary. Please try again later." };
    }
}
