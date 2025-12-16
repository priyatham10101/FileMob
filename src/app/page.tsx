"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { type ExtractedContent, extractTextFromFile, getSummary } from "./actions";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

import { Download, FileText, Loader2, Sparkles, UploadCloud, Copy } from 'lucide-react';

const initialState = {
  error: null,
  extractedContent: null,
};

// Utility to clean file names by removing non-ASCII characters (preserve extension)
function cleanFileName(fileName: string): string {
  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
  const base = fileName.replace(new RegExp(ext + '$'), '');
  // Remove non-ASCII chars from base, collapse spaces, trim
  const cleanedBase = base.replace(/[^\x20-\x7E]+/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
  return cleanedBase + ext;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Extracting...
        </>
      ) : (
        <>
          <FileText className="mr-2 h-4 w-4" />
          Extract Content
        </>
      )}
    </Button>
  );
}

export default function FileMobPage() {
  const [state, formAction] = useActionState(extractTextFromFile, initialState);
  const [fileName, setFileName] = useState<string>("");
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  // Add state for copy feedback
  const [copied, setCopied] = useState(false);

  // Helper to count words
  function countWords(text: string) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  useEffect(() => {
    if (state.error) {
      toast({
        variant: "destructive",
        title: "An error occurred",
        description: state.error,
      });
    }
    if (state.extractedContent) {
        setSummary(null); // Reset summary when new file is processed
    }
  }, [state, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(cleanFileName(file.name));
    } else {
      setFileName("");
    }
  };

  const handleSummarize = async () => {
    if (!state.extractedContent?.fullText) return;
    setIsSummaryLoading(true);
    const result = await getSummary(state.extractedContent.fullText);
    if (result.error) {
        toast({
            variant: "destructive",
            title: "Summarization Failed",
            description: result.error,
        });
    } else {
        setSummary(result.summary ?? null);
    }
    setIsSummaryLoading(false);
  };
  
  const handleDownload = () => {
    if (!state.extractedContent) return;
    const { filename, fullText } = state.extractedContent;
    
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanFileName(filename.split('.').slice(0, -1).join('.'))}_extracted.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!state.extractedContent?.fullText) return;
    navigator.clipboard.writeText(state.extractedContent.fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-background to-muted/30 flex flex-col items-center p-4 sm:p-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="font-headline text-5xl sm:text-6xl font-extrabold text-primary tracking-tight">FileMob</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">Unlock insights from any document. Upload a file to instantly extract text and generate an AI-powered summary.</p>
      </div>

      {/* Bulk Extract Feature Card/Button */}
      <div className="w-full max-w-3xl flex justify-center">
        <a href="/bulk-extract" className="block w-full">
          <Card className="w-full shadow-lg border-primary/40 bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <UploadCloud className="h-6 w-6" />
                Bulk Folder Extract
              </CardTitle>
              <CardDescription>Automatically extract and convert all supported files from a folder to .txt files in another folder.</CardDescription>
            </CardHeader>
          </Card>
        </a>
      </div>

      <Card className="w-full max-w-3xl shadow-lg border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>Select a PDF, DOC, DOCX, TXT, or MD file from your computer.</CardDescription>
        </CardHeader>
        <form action={formAction} ref={formRef}>
          <CardContent className="space-y-4">
              <Label htmlFor="file-upload" className="block">
                <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                    <UploadCloud className="w-12 h-12 mb-4 text-primary" />
                    <p className="mb-2 text-lg text-foreground font-semibold">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground">PDF, DOC, DOCX, TXT, MD (MAX. 5MB)</p>
                  </div>
                  <Input id="file-upload" name="file" type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.md" onChange={handleFileChange} />
                </div>
              </Label>
              {fileName && <p className="text-sm text-center text-muted-foreground">Selected file: <span className="font-medium text-foreground">{cleanFileName(fileName)}</span></p>}
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>
      
      {state.extractedContent && (
         <Card className="w-full max-w-3xl shadow-lg animate-in fade-in-50 duration-500 bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="break-words">{cleanFileName(state.extractedContent.filename)}</CardTitle>
                <CardDescription>Extracted content and AI tools.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="text" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="text">Extracted Text</TabsTrigger>
                        <TabsTrigger value="summary">AI Summary</TabsTrigger>
                    </TabsList>
                    <TabsContent value="text" className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-muted-foreground">
                            {state.extractedContent?.fullText && (
                              <>
                                <span>{state.extractedContent.fullText.length} chars</span>
                                <span className="mx-2">|</span>
                                <span>{countWords(state.extractedContent.fullText)} words</span>
                              </>
                            )}
                          </div>
                          <Button size="icon" variant="ghost" onClick={handleCopy} title="Copy extracted text">
                            <Copy className="w-4 h-4" />
                          </Button>
                          {copied && <span className="ml-2 text-green-600 text-xs">Copied!</span>}
                        </div>
                        <ScrollArea className="h-96 w-full rounded-md border bg-background/50 p-4">
                            <pre className="text-sm whitespace-pre-wrap font-code">{state.extractedContent.fullText}</pre>
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="summary" className="mt-4">
                       <div className="p-4 border rounded-lg min-h-[200px] flex flex-col justify-center items-center space-y-4 bg-background/50">
                           {isSummaryLoading ? (
                               <div className="w-full space-y-2">
                                   <Skeleton className="h-4 w-full" />
                                   <Skeleton className="h-4 w-full" />
                                   <Skeleton className="h-4 w-3/4" />
                               </div>
                           ) : summary ? (
                                <ScrollArea className="h-96 w-full">
                                  <p className="text-sm text-foreground p-1 whitespace-pre-wrap">{summary}</p>
                                </ScrollArea>
                           ) : (
                                <>
                                    <Sparkles className="h-10 w-10 text-primary" />
                                    <p className="text-muted-foreground text-center">Generate a concise summary of the document's content.</p>
                                    <Button onClick={handleSummarize}>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Summarize with AI
                                    </Button>
                                </>
                           )}
                       </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleDownload} className="w-full sm:w-auto" variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download Text
                 </Button>
            </CardFooter>
        </Card>
      )}

    </main>
  );
}
