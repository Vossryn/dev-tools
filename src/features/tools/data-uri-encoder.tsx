import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, File as FileIcon, Upload, X } from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export default function DataUriEncoder() {
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [textInput, setTextInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [output, setOutput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        processFile(selectedFile);
      }
      // Reset input value to allow selecting the same file again
      event.target.value = "";
    },
    []
  );

  const processFile = (fileToProcess: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setOutput(reader.result);
      }
    };
    reader.readAsDataURL(fileToProcess);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setTextInput(text);
    if (text) {
      // Simple base64 encoding for text
      // Note: btoa handles Latin1 only. For UTF-8, we need a bit more work if we want to be robust,
      // but for a simple data URI encoder, we can assume text/plain;charset=utf-8
      try {
        const encoded = btoa(unescape(encodeURIComponent(text)));
        setOutput(`data:text/plain;charset=utf-8;base64,${encoded}`);
      } catch (err) {
        console.error("Encoding error:", err);
        setOutput("Error encoding text");
      }
    } else {
      setOutput("");
    }
  };

  const copyToClipboard = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      toast.success("Copied to clipboard");
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const clearFile = () => {
    setFile(null);
    setOutput("");
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Data URI Encoder</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Convert files or text strings into Base64 Data URIs for quick inlining
          in HTML, CSS, or JSON.
        </p>
      </header>

      <div className="grid gap-6 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex gap-4 border-b pb-4">
          <Button
            variant={inputMode === "file" ? "default" : "outline"}
            onClick={() => {
              setInputMode("file");
              setOutput("");
              setTextInput("");
            }}
          >
            Convert File
          </Button>
          <Button
            variant={inputMode === "text" ? "default" : "outline"}
            onClick={() => {
              setInputMode("text");
              setFile(null);
              setOutput("");
            }}
          >
            Convert String
          </Button>
        </div>

        <div className="grid gap-4">
          {inputMode === "file" ? (
            <div className="grid gap-4">
              <Label>Upload File</Label>
              {!file ? (
                <div
                  className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors hover:bg-muted/50 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="rounded-full bg-muted p-4">
                    <Upload className="size-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Any file type supported
                    </p>
                  </div>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-muted p-2">
                      <FileIcon className="size-4" />
                    </div>
                    <div className="grid gap-0.5">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.type || "Unknown type"} •{" "}
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearFile}>
                    <X className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="text-input">Input Text</Label>
              <Textarea
                id="text-input"
                placeholder="Type or paste text here..."
                className="min-h-[150px] font-mono text-sm"
                value={textInput}
                onChange={handleTextChange}
              />
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="output">Data URI Output</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 text-xs"
              onClick={copyToClipboard}
              disabled={!output}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
          <Textarea
            id="output"
            readOnly
            value={output}
            className="min-h-[150px] font-mono text-xs text-muted-foreground"
            placeholder="Data URI will appear here..."
          />
        </div>
      </div>
    </div>
  );
}
