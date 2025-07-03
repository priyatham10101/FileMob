"use client";

import { useFormStatus } from "react-dom";
import { useState, useEffect, useRef, useActionState } from "react";
import { extractTextFromFile, getSummary, type ExtractedContent } from "./actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

import { FileUp, Download, Sparkles, Loader2, FileText } from 'lucide-react';

const initialState = {
  error: null,
  extractedContent: null,
};

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

export default function DocuExtractPage() {
  const [state, formAction] = useActionState(extractTextFromFile, initialState);
  const [fileName, setFileName] = useState<string>("");
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

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
      setFileName(file.name);
    } else {
      setFileName("");
    }
  };

  const handleSummarize = async () => {
    if (!state.extractedContent?.body) return;
    setIsSummaryLoading(true);
    const result = await getSummary(state.extractedContent.body);
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
    const { filename, header, body, footer } = state.extractedContent;
    const fullText = `
Document: ${filename}

================== HEADER ==================
${header || 'No header content extracted.'}

================== BODY ==================
${body || 'No body content extracted.'}

================== FOOTER ==================
${footer || 'No footer content extracted.'}
    `.trim();
    
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.split('.').slice(0, -1).join('.')}_extracted.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen w-full bg-background flex flex-col items-center p-4 sm:p-8 space-y-8">
      <div className="text-center">
        <h1 className="font-headline text-4xl sm:text-5xl font-bold text-primary">DocuExtract</h1>
        <p className="text-muted-foreground mt-2 text-lg">Upload a document to extract its text and generate an AI summary.</p>
      </div>

      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>Select a .doc or .docx file from your computer.</CardDescription>
        </CardHeader>
        <form action={formAction} ref={formRef}>
          <CardContent className="space-y-4">
              <Label htmlFor="file-upload" className="block">
                <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileUp className="w-10 h-10 mb-3 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-muted-foreground">DOC, DOCX (MAX. 5MB)</p>
                  </div>
                  <Input id="file-upload" name="file" type="file" className="hidden" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileChange} />
                </div>
              </Label>
              {fileName && <p className="text-sm text-center text-muted-foreground">Selected file: <span className="font-medium text-foreground">{fileName}</span></p>}
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>
      
      {state.extractedContent && (
         <Card className="w-full max-w-3xl shadow-lg animate-in fade-in-50 duration-500">
            <CardHeader>
                <CardTitle>{state.extractedContent.filename}</CardTitle>
                <CardDescription>Extracted content and AI tools.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="text" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="text">Extracted Text</TabsTrigger>
                        <TabsTrigger value="summary">AI Summary</TabsTrigger>
                    </TabsList>
                    <TabsContent value="text" className="mt-4">
                        <Accordion type="single" collapsible defaultValue="body" className="w-full">
                            <AccordionItem value="body">
                                <AccordionTrigger>Body</AccordionTrigger>
                                <AccordionContent>
                                    <ScrollArea className="h-72 w-full rounded-md border p-4">
                                        <pre className="text-sm whitespace-pre-wrap">{state.extractedContent.body || "No body content."}</pre>
                                    </ScrollArea>
                                </AccordionContent>
                            </AccordionItem>
                            {state.extractedContent.header && (
                                <AccordionItem value="header">
                                    <AccordionTrigger>Header</AccordionTrigger>
                                    <AccordionContent>
                                        <ScrollArea className="h-40 w-full rounded-md border p-4">
                                            <pre className="text-sm whitespace-pre-wrap">{state.extractedContent.header}</pre>
                                        </ScrollArea>
                                    </AccordionContent>
                                </AccordionItem>
                            )}
                            {state.extractedContent.footer && (
                                <AccordionItem value="footer">
                                    <AccordionTrigger>Footer</AccordionTrigger>
                                    <AccordionContent>
                                        <ScrollArea className="h-40 w-full rounded-md border p-4">
                                            <pre className="text-sm whitespace-pre-wrap">{state.extractedContent.footer}</pre>
                                        </ScrollArea>
                                    </AccordionContent>
                                </AccordionItem>
                            )}
                        </Accordion>
                    </TabsContent>
                    <TabsContent value="summary" className="mt-4">
                       <div className="p-4 border rounded-lg min-h-[200px] flex flex-col justify-center items-center space-y-4">
                           {isSummaryLoading ? (
                               <div className="w-full space-y-2">
                                   <Skeleton className="h-4 w-full" />
                                   <Skeleton className="h-4 w-full" />
                                   <Skeleton className="h-4 w-3/4" />
                               </div>
                           ) : summary ? (
                                <ScrollArea className="h-72 w-full">
                                  <p className="text-sm text-foreground p-1">{summary}</p>
                                </ScrollArea>
                           ) : (
                                <>
                                    <Sparkles className="h-8 w-8 text-muted-foreground" />
                                    <p className="text-muted-foreground text-center">Generate a concise summary of the document's body content.</p>
                                    <Button onClick={handleSummarize} variant="secondary" style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
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
