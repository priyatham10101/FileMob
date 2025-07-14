import { NextRequest } from 'next/server';
import chokidar from 'chokidar';
import path from 'path';

// Store active watchers
const watchers = new Map<string, any>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folderPath = searchParams.get('path');

  if (!folderPath) {
    return new Response('Folder path is required', { status: 400 });
  }

  // Set up SSE headers
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode('data: {"type":"connected","message":"File watcher connected"}\n\n'));

      // Check if we already have a watcher for this path
      if (watchers.has(folderPath)) {
        controller.enqueue(encoder.encode('data: {"type":"info","message":"Already watching this folder"}\n\n'));
        return;
      }

      try {
        // Create a new file watcher
        const watcher = chokidar.watch(folderPath, {
          ignored: /(^|[\/\\])\../, // ignore dotfiles
          persistent: true,
          ignoreInitial: true, // Don't emit events for existing files
          awaitWriteFinish: {
            stabilityThreshold: 1000, // Wait 1 second after file stops changing
            pollInterval: 100
          }
        });

        // Handle file events
        watcher.on('add', (filePath) => {
          const fileName = path.basename(filePath);
          const ext = path.extname(fileName).toLowerCase().slice(1);
          const allowedExtensions = ['doc', 'docx', 'pdf', 'md', 'txt'];
          
          if (allowedExtensions.includes(ext)) {
            const message = JSON.stringify({
              type: 'fileAdded',
              fileName,
              filePath
            });
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          }
        });

        watcher.on('unlink', (filePath) => {
          const fileName = path.basename(filePath);
          const message = JSON.stringify({
            type: 'fileRemoved',
            fileName,
            filePath
          });
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        });

        watcher.on('error', (error) => {
          console.error('File watcher error:', error);
          const message = JSON.stringify({
            type: 'error',
            error: (error as Error).message
          });
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        });

        // Store the watcher
        watchers.set(folderPath, watcher);

        // Handle client disconnect
        req.signal.addEventListener('abort', () => {
          watcher.close();
          watchers.delete(folderPath);
        });

      } catch (error) {
        const message = JSON.stringify({
          type: 'error',
          error: (error as Error).message
        });
        controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folderPath = searchParams.get('path');

  if (!folderPath) {
    return new Response('Folder path is required', { status: 400 });
  }

  const watcher = watchers.get(folderPath);
  if (watcher) {
    await watcher.close();
    watchers.delete(folderPath);
    return new Response(JSON.stringify({ message: 'File watcher stopped' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ message: 'No active watcher for this path' }), {
    headers: { 'Content-Type': 'application/json' }
  });
} 