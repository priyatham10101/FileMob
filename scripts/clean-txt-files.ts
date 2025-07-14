import fs from 'fs/promises';
import path from 'path';

const OUTPUT_DIR = path.resolve(__dirname, '../output');

function advancedCleanText(text: string): string {
  let cleaned = text.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
  cleaned = cleaned.replace(/ {2,}/g, ' ');
  // cleaned = cleaned.replace(/[^\x00-\x7F]+/g, ''); // Uncomment to remove non-ASCII
  cleaned = cleaned.replace(/^(Professional summary|Work Experience|Skills|Education Credential|Languages Known:|Personal Profile:)/gim, '\n$1\n');
  cleaned = cleaned.replace(/^[•\-\*]/gm, '-');
  cleaned = cleaned.replace(/^\s*[-–—]+\s*$/gm, '');
  cleaned = cleaned.replace(/\.{2,}/g, '.');
  return cleaned.trim();
}

async function cleanAllTxtFiles() {
  const files = await fs.readdir(OUTPUT_DIR);
  for (const file of files) {
    if (!file.endsWith('.txt')) continue;
    const filePath = path.join(OUTPUT_DIR, file);
    let text = await fs.readFile(filePath, 'utf-8');
    const cleaned = advancedCleanText(text);
    await fs.writeFile(filePath, cleaned, 'utf-8');
    console.log(`Cleaned: ${file}`);
  }
}

cleanAllTxtFiles().catch(err => {
  console.error('Error cleaning txt files:', err);
  process.exit(1);
}); 