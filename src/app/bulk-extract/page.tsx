"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen, FileText, Play, StopCircle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

// Status colors
const STATUS_COLORS = {
  processed: 'text-green-600',
  failed: 'text-red-600',
  queue: 'text-yellow-600',
};

// Utility to clean file names by removing non-ASCII characters (preserve extension)
function cleanFileName(fileName: string): string {
  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
  const base = fileName.replace(new RegExp(ext + '$'), '');
  // Remove non-ASCII chars from base, collapse spaces, trim
  const cleanedBase = base.replace(/[^\x20-\x7E]+/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
  return cleanedBase + ext;
}

export default function BulkExtractPage() {
  const [inputPath, setInputPath] = useState("/Users/admin/dev/FileMob/input");
  const [outputPath, setOutputPath] = useState("/Users/admin/dev/FileMob/output");
  const [inputFiles, setInputFiles] = useState<string[]>([]);
  const [outputFiles, setOutputFiles] = useState<string[]>([]);
  const [fileStatus, setFileStatus] = useState<Record<string, 'processed' | 'failed' | 'queue'>>({});
  const [log, setLog] = useState<string[]>([]);
  const [loadingInput, setLoadingInput] = useState(false);
  const [loadingOutput, setLoadingOutput] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [inputFolderError, setInputFolderError] = useState<string | null>(null);
  const [outputFolderError, setOutputFolderError] = useState<string | null>(null);
  const [autoDetect, setAutoDetect] = useState(true);
  const [isWatching, setIsWatching] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // File watcher using Server-Sent Events
  const startFileWatcher = () => {
    if (!inputPath || !autoDetect || processing) return;
    
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource(`/api/bulk-extract/watch-files?path=${encodeURIComponent(inputPath)}`);
      
      eventSource.onopen = () => {
    setIsWatching(true);
        setLog(prev => [`File watcher connected for: ${inputPath}`, ...prev]);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'fileAdded':
              setInputFiles(prevFiles => {
                if (!prevFiles.includes(data.fileName)) {
                  setLog(prev => [
                    `New file detected: ${data.fileName}`,
                    ...prev,
                  ]);
                  return [...prevFiles, data.fileName];
                }
                return prevFiles;
              });
              break;
              
            case 'fileRemoved':
              setInputFiles(prevFiles => {
                const newFiles = prevFiles.filter(file => file !== data.fileName);
                if (newFiles.length !== prevFiles.length) {
                  setLog(prev => [
                    `File removed: ${data.fileName}`,
                    ...prev,
                  ]);
                }
                return newFiles;
              });
              break;
              
            case 'error':
              setLog(prev => [`File watcher error: ${data.error}`, ...prev]);
              break;
              
            case 'connected':
            case 'info':
              // Just log info messages
              setLog(prev => [data.message, ...prev]);
              break;
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        setIsWatching(false);
        setLog(prev => ['File watcher connection lost', ...prev]);
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('Failed to start file watcher:', err);
      setLog(prev => [`Failed to start file watcher: ${(err as Error).message}`, ...prev]);
    }
  };

  // Start/stop file watcher based on autoDetect state
  useEffect(() => {
    if (autoDetect && inputPath && !processing) {
      startFileWatcher();
    } else {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
    setIsWatching(false);
      }
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [autoDetect, inputPath, processing]);

  // Fetch input files
  const handleLoadInputFiles = async () => {
    if (!inputPath) return;
    setLoadingInput(true);
    setInputFolderError(null);
    setLog((prev) => [
      `Loading files from: ${inputPath}`,
      ...prev,
    ]);
    try {
      const res = await fetch("/api/bulk-extract/list-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: inputPath }),
      });
      const data = await res.json();
      if (data.files) {
        setInputFiles(data.files);
        setLog((prev) => [
          `Found ${data.files.length} file(s) in input folder.`,
          ...prev,
        ]);
        setInputFolderError(null);
      } else {
        setInputFiles([]);
        setLog((prev) => [
          `Error: ${data.error || "Unknown error"}`,
          ...prev,
        ]);
        if (data.error && data.error.toLowerCase().includes('no such file or directory')) {
          setInputFolderError('Input folder does not exist.');
        } else if (data.error) {
          setInputFolderError(data.error);
        } else {
          setInputFolderError('Unknown error loading input folder.');
        }
      }
    } catch (err) {
      setInputFiles([]);
      setLog((prev) => [
        `Error: ${(err as Error).message}`,
        ...prev,
      ]);
      setInputFolderError('Error loading input folder.');
    } finally {
      setLoadingInput(false);
    }
  };

  // Fetch output files
  const handleLoadOutputFiles = async () => {
    if (!outputPath) return;
    setLoadingOutput(true);
    setOutputFolderError(null);
    setLog((prev) => [
      `Loading files from: ${outputPath}`,
      ...prev,
    ]);
    try {
      const res = await fetch("/api/bulk-extract/list-output-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: outputPath }),
      });
      const data = await res.json();
      if (data.files) {
        setOutputFiles(data.files);
        setLog((prev) => [
          `Found ${data.files.length} file(s) in output folder.`,
          ...prev,
        ]);
        setOutputFolderError(null);
      } else {
        setOutputFiles([]);
        setLog((prev) => [
          `Error: ${data.error || "Unknown error"}`,
          ...prev,
        ]);
        if (data.error && data.error.toLowerCase().includes('no such file or directory')) {
          setOutputFolderError('Output folder does not exist.');
        } else if (data.error) {
          setOutputFolderError(data.error);
        } else {
          setOutputFolderError('Unknown error loading output folder.');
        }
      }
    } catch (err) {
      setOutputFiles([]);
      setLog((prev) => [
        `Error: ${(err as Error).message}`,
        ...prev,
      ]);
      setOutputFolderError('Error loading output folder.');
    } finally {
      setLoadingOutput(false);
    }
  };

  // Start processing
  const handleStartProcessing = async () => {
    if (!inputPath || !outputPath || !inputFiles.length) return;
    setProcessing(true);
    setLog((prev) => [
      `Starting processing of ${inputFiles.length} files...`,
      ...prev,
    ]);
    try {
      const res = await fetch("/api/bulk-extract/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputPath, outputPath, files: inputFiles }),
      });
      const data = await res.json();
      if (data.statuses) {
        setFileStatus((prev) => ({ ...prev, ...data.statuses }));
      }
      if (data.logs) {
        // Reformat logs: look for lines like 'Processed successfully.' or 'Failed to process.'
        const formattedLogs = data.logs.map((line: string) => {
          // Try to extract file and status
          const match = line.match(/^(.*?): (Processed successfully\.|Failed - .*|Skipped - .*)$/);
          if (match) {
            let status = '';
            if (match[2].startsWith('Processed')) status = 'Processed';
            else if (match[2].startsWith('Failed') || match[2].startsWith('Skipped')) status = 'Failed';
            else status = 'Info';
            return `[${status}] ${match[1]}`;
          }
          return line;
        });
        setLog((prev) => [...formattedLogs, ...prev]);
      }
      // Refresh output files
      await handleLoadOutputFiles();
    } catch (err) {
      setLog((prev) => [
        `Error: ${(err as Error).message}`,
        ...prev,
      ]);
    } finally {
      setProcessing(false);
    }
  };

  // Save logs as a file (browser-based, no file-saver)
  const handleSaveLogs = () => {
    const processedCount = Object.values(fileStatus).filter(s => s === 'processed').length;
    const failedCount = Object.values(fileStatus).filter(s => s === 'failed').length;
    const totalCount = inputFiles.length;
    const metadata = [
      `Input folder: ${inputPath || '-'}\n`,
      `Output folder: ${outputPath || '-'}\n`,
      `Total files: ${totalCount}\n`,
      `Files parsed: ${processedCount}\n`,
      `Failed: ${failedCount}\n`,
      '\n--- Log ---\n',
    ];
    const logLines = log.length ? log.map(line => line + '\n') : ['No activity yet.\n'];
    const fileList = [
      '\n--- Files ---\n',
      ...inputFiles.map(f => f + '\n'),
    ];
    const content = [...metadata, ...logLines, ...fileList].join('');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-extract-log-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  // Initialize file status to 'queue' for all input files
  React.useEffect(() => {
    const status: Record<string, 'processed' | 'failed' | 'queue'> = {};
    inputFiles.forEach((file) => {
      // If we don't have a status for this file yet, set it to 'queue'
      if (!fileStatus[file]) {
        status[file] = 'queue';
      }
    });
    if (Object.keys(status).length > 0) {
      setFileStatus((prev) => ({ ...prev, ...status }));
    }
  }, [inputFiles]);

  // Compute stats for processed and failed
  const processedCount = Object.values(fileStatus).filter(s => s === 'processed').length;
  const failedCount = Object.values(fileStatus).filter(s => s === 'failed').length;
  const totalCount = inputFiles.length;

  // Status badge component
  function StatusBadge({ status }: { status: 'processed' | 'failed' | 'queue' }) {
    let color, label;
    if (status === 'processed') {
      color = 'bg-green-100 text-green-700 border-green-300';
      label = 'Processed';
    } else if (status === 'failed') {
      color = 'bg-red-100 text-red-700 border-red-300';
      label = 'Failed';
    } else {
      color = 'bg-yellow-100 text-yellow-700 border-yellow-300';
      label = 'In Queue';
    }
    return <Badge className={`border ${color} px-2 py-0.5 text-xs font-semibold rounded-full`}>{label}</Badge>;
  }

  return (
    <TooltipProvider>
      <main className="min-h-screen w-full flex flex-col items-center p-4 sm:p-8 space-y-8 bg-muted font-body">
      <div className="text-center space-y-2">
          <h1 className="font-headline text-5xl font-extrabold text-primary tracking-tight mb-2">Bulk Folder Extract</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Automatically extract and convert all supported files from a folder to .txt files in another folder.</p>
      </div>
        <div className="flex flex-col md:flex-row gap-8 w-full max-w-[1800px]">
          {/* Input Folder Card */}
          <Card className="flex flex-col flex-1 rounded-xl shadow-lg border border-border bg-white min-h-[700px] max-h-[900px] p-4 min-w-[340px] max-w-[540px]">
        <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary text-2xl">
                <FolderOpen className="h-6 w-6" /> Input Folder
              </CardTitle>
              <CardDescription className="text-base">Enter the path to the folder to extract files from.</CardDescription>
        </CardHeader>
            <CardContent className="flex-1 min-h-0 flex flex-col">
              <div className="flex gap-2 mb-4">
                <input
                type="text"
                  value={inputPath}
                  onChange={e => setInputPath(e.target.value)}
                  placeholder="/absolute/path/to/input"
                  className="border rounded-lg px-4 py-2 w-full text-base bg-background focus:ring-2 focus:ring-primary focus:outline-none transition"
                />
                <Button onClick={handleLoadInputFiles} disabled={!inputPath || loadingInput} size="lg">
                  {loadingInput ? "Loading..." : <><FolderOpen className="h-4 w-4 mr-1" />Load</>}
                </Button>
              </div>
              {inputFolderError && (
                <div className="text-red-600 text-xs mt-1">{inputFolderError}</div>
              )}
              {/* Auto-detection toggle */}
              <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  {autoDetect ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-gray-500" />}
                  <span className="text-sm font-medium">Auto-detect new files</span>
                  {isWatching && <RefreshCw className="h-3 w-3 text-blue-600 animate-spin" />}
                </div>
                <Switch
                  checked={autoDetect}
                  onCheckedChange={setAutoDetect}
                  disabled={processing}
                />
              </div>
              <Separator className="mb-2" />
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-sm text-muted-foreground">Files</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-1 cursor-pointer text-xs text-muted-foreground">?</span>
                  </TooltipTrigger>
                  <TooltipContent side="top">Only PDF, DOC, DOCX, TXT, MD files are shown.</TooltipContent>
                </Tooltip>
              </div>
              <ScrollArea className="flex-1 min-h-0 w-full rounded-md border bg-background/60 p-2">
                <div className="text-sm font-mono whitespace-pre-wrap space-y-1">
                  {inputFiles.length === 0 ? (
                    <span className="text-muted-foreground">No files found.</span>
                  ) : (
                    inputFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 justify-between px-1 py-0.5 rounded hover:bg-primary/10 transition">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[160px] md:max-w-[220px]">{cleanFileName(file)}</span>
                        </div>
                        <StatusBadge status={fileStatus[file] || 'queue'} />
                      </div>
                    ))
                  )}
          </div>
              </ScrollArea>
        </CardContent>
      </Card>
          {/* Middle Card: Output path, options, start/stop, log */}
          <Card className="flex flex-col flex-1 rounded-xl shadow-lg border border-border bg-white min-h-[700px] max-h-[900px] p-4 min-w-[340px] max-w-[540px]">
        <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary text-2xl">
                <Play className="h-6 w-6" /> Controls & Log
              </CardTitle>
              <CardDescription className="text-base">Set output folder, start/stop, and view logs.</CardDescription>
        </CardHeader>
            <CardContent className="flex-1 min-h-0 flex flex-col">
              <div className="flex gap-2 mb-4">
                <Button onClick={handleStartProcessing} disabled={processing || !inputFiles.length || !outputPath} size="lg">
                  <Play className="h-4 w-4 mr-1" /> Start
                </Button>
                <Button onClick={() => setProcessing(false)} disabled={!processing} variant="destructive" size="lg">
                  <StopCircle className="h-4 w-4 mr-1" /> Stop
                </Button>
                <Button onClick={handleSaveLogs} variant="outline" size="lg" disabled={!log.length && !inputFiles.length && !inputPath && !outputPath}>
                  Save Logs
                </Button>
              </div>
              {/* Files parsed summary with progress bar */}
              <div className="mb-4">
                <div className="flex flex-wrap gap-4 mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Total: {totalCount}</span>
                  <span className="text-xs font-medium text-green-700">Processed: {processedCount}</span>
                  <span className="text-xs font-medium text-red-700">Failed: {failedCount}</span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-primary">Files parsed</span>
                  <span className="text-xs font-medium text-muted-foreground">{processedCount} of {totalCount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div
                    className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${totalCount ? (processedCount / totalCount) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <Separator className="mb-2" />
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-sm text-muted-foreground">Log</span>
                <Button variant="ghost" size="sm" className="text-xs px-2 py-0.5" onClick={() => setLog([])}>Clear</Button>
              </div>
              <ScrollArea className="flex-1 min-h-0 w-full rounded-md border bg-background/60 p-2">
                <div className="text-xs font-mono whitespace-pre-wrap space-y-1">
              {log.length === 0 ? <span className="text-muted-foreground">No activity yet.</span> : log.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
          {/* Output Folder Card */}
          <Card className="flex flex-col flex-1 rounded-xl shadow-lg border border-border bg-white min-h-[700px] max-h-[900px] p-4 min-w-[340px] max-w-[540px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary text-2xl">
                <FolderOpen className="h-6 w-6" /> Output Folder
              </CardTitle>
              <CardDescription className="text-base">Files in the output folder (.txt).</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 flex flex-col">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={outputPath}
                  onChange={e => setOutputPath(e.target.value)}
                  placeholder="/absolute/path/to/output"
                  className="border rounded-lg px-4 py-2 w-full text-base bg-background focus:ring-2 focus:ring-primary focus:outline-none transition"
                />
                <Button onClick={handleLoadOutputFiles} disabled={!outputPath || loadingOutput} size="lg">
                  {loadingOutput ? "Loading..." : <><FolderOpen className="h-4 w-4 mr-1" />Load</>}
                </Button>
              </div>
              {outputFolderError && (
                <div className="text-red-600 text-xs mt-1">{outputFolderError}</div>
              )}
              <ScrollArea className="flex-1 min-h-0 w-full rounded-md border bg-background/60 p-2">
                <div className="text-sm font-mono whitespace-pre-wrap space-y-1">
                  {outputFiles.length === 0 ? (
                    <span className="text-muted-foreground">No files found.</span>
                  ) : (
                    outputFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-primary/10 transition text-green-700">
                        <FileText className="h-4 w-4" />
                        <span className="truncate max-w-[180px] md:max-w-[240px]">{cleanFileName(file)}</span>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
    </main>
    </TooltipProvider>
  );
} 