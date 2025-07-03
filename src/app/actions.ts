'use server';

import WordExtractor from 'word-extractor';
import { summarizeDocument } from '@/ai/flows/summarize-document';
import { z } from 'zod';

const WordExtractorResultSchema = z.object({
  getBody: z.function().returns(z.string()),
  getFooters: z.function().returns(z.string()),
  getHeaders: z.function().returns(z.string()),
});

export interface ExtractedContent {
  filename: string;
  body: string;
  header: string;
  footer: string;
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

  const allowedTypes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  
  const isAllowedType = allowedTypes.includes(file.type) || file.name.endsWith('.doc') || file.name.endsWith('.docx');

  if (!isAllowedType) {
    return { ...prevState, error: 'Invalid file type. Please upload a .doc or .docx file.' };
  }
  
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return { ...prevState, error: 'File is too large. Maximum size is 5MB.'};
  }

  try {
    const buffer = await file.arrayBuffer();
    const extractor = new WordExtractor();
    const doc = await extractor.extract(Buffer.from(buffer));

    const parsedDoc = WordExtractorResultSchema.safeParse(doc);
    if (!parsedDoc.success) {
        console.error("Word Extractor couldn't parse the document.", parsedDoc.error);
        return { ...prevState, error: "Failed to parse the document. It might be corrupted or in an unsupported format." };
    }

    const body = doc.getBody();
    const header = doc.getHeaders();
    const footer = doc.getFooters();

    return {
      extractedContent: {
        filename: file.name,
        body,
        header,
        footer,
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
        return { error: "There is not enough content in the document body to generate a summary." };
    }
    try {
        const result = await summarizeDocument({ text });
        return { summary: result.summary };
    } catch (error) {
        console.error("AI summarization failed:", error);
        return { error: "The AI failed to generate a summary. Please try again later." };
    }
}
