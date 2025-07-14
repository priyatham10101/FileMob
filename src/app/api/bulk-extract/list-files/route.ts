import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.md'];

export async function POST(req: NextRequest) {
  try {
    const { path: folderPath } = await req.json();
    if (!folderPath || typeof folderPath !== 'string') {
      return NextResponse.json({ error: 'No path provided.' }, { status: 400 });
    }
    // Read directory
    let files: string[] = [];
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      files = entries
        .filter(
          (entry) =>
            entry.isFile() &&
            ALLOWED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
        )
        .map((entry) => entry.name);
    } catch (err) {
      return NextResponse.json({ error: 'Cannot read directory: ' + (err as Error).message }, { status: 400 });
    }
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
} 