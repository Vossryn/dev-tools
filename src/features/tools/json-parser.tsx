import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Minimize2,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/hooks/use-debounce";

const INDENT_OPTIONS = ["2", "4", "tab"] as const;

type IndentOption = (typeof INDENT_OPTIONS)[number];

type ParseState =
  | { status: "empty" }
  | {
      status: "valid";
      value: unknown;
      formatted: string;
      bytes: number;
      characters: number;
      rootType: string;
      entryCount?: number;
    }
  | {
      status: "invalid";
      message: string;
      line?: number;
      column?: number;
      pointer?: string;
    };

type JsonErrorDetails = {
  message?: string;
  line?: number;
  column?: number;
  pointer?: string;
};

const indentLabels: Record<IndentOption, string> = {
  "2": "2 spaces",
  "4": "4 spaces",
  tab: "Tab character",
};

const INITIAL_SAMPLE = `{
  "name": "Example",
  "version": 1,
  "items": [
    { "id": "alpha", "active": true },
    { "id": "beta", "active": false }
  ]
}`;

function isIndentOption(value: string): value is IndentOption {
  return INDENT_OPTIONS.includes(value as IndentOption);
}

function getByteSize(input: string) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(input).length;
  }
  return input.length;
}

function formatByteSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = unitIndex === 0 ? Math.round(value) : Number(value.toFixed(value >= 10 ? 0 : 1));
  return `${rounded} ${units[unitIndex]}`;
}

function buildPointerSnippet(source: string, line: number, column: number) {
  const normalizedLine = Math.max(line, 1);
  const normalizedColumn = Math.max(column, 1);
  const lines = source.split(/\r?\n/);
  const targetLine = lines[normalizedLine - 1] ?? "";
  const caretLine = `${" ".repeat(Math.max(0, normalizedColumn - 1))}^`;
  return `${targetLine}\n${caretLine}`;
}

function derivePointerFromIndex(source: string, index: number) {
  const safeIndex = Math.max(0, Math.min(index, source.length));
  const preceding = source.slice(0, safeIndex);
  const segments = preceding.split(/\r?\n/);
  const line = segments.length;
  const column = (segments[segments.length - 1]?.length ?? 0) + 1;
  return {
    line,
    column,
    pointer: buildPointerSnippet(source, line, column),
  };
}

function derivePointerFromLineColumn(source: string, line: number, column: number) {
  return {
    pointer: buildPointerSnippet(source, line, column),
  };
}

function getJsonErrorDetails(source: string, error: unknown): JsonErrorDetails {
  const defaultMessage = "Unable to parse JSON.";
  if (!error || typeof error !== "object") {
    return { message: defaultMessage };
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : defaultMessage;

  const details: JsonErrorDetails = { message };

  const positionMatch = message.match(/position\s(\d+)/iu);
  if (positionMatch) {
    const position = Number.parseInt(positionMatch[1] ?? "", 10);
    if (Number.isFinite(position)) {
      return { ...details, ...derivePointerFromIndex(source, position) };
    }
  }

  const lineColumnMatch = message.match(/line\s(\d+)\scolumn\s(\d+)/iu);
  if (lineColumnMatch) {
    const line = Number.parseInt(lineColumnMatch[1] ?? "", 10);
    const column = Number.parseInt(lineColumnMatch[2] ?? "", 10);
    if (Number.isFinite(line) && Number.isFinite(column)) {
      return {
        ...details,
        line,
        column,
        ...derivePointerFromLineColumn(source, line, column),
      };
    }
  }

  return details;
}

const JsonParserTool: React.FC = () => {
  const [rawInput, setRawInput] = useState<string>(INITIAL_SAMPLE);
  const [indentSetting, setIndentSetting] = useState<IndentOption>("2");
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumberContentRef = useRef<HTMLPreElement | null>(null);

  const debouncedInput = useDebounce(rawInput, 300);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) {
        clearTimeout(copyResetRef.current);
        copyResetRef.current = null;
      }
    };
  }, []);

  const parseState: ParseState = useMemo(() => {
    if (!debouncedInput.trim()) {
      return { status: "empty" };
    }

    try {
      const parsed = JSON.parse(debouncedInput);
      const characters = debouncedInput.length;
      const bytes = getByteSize(debouncedInput);
      const rootType = Array.isArray(parsed)
        ? "array"
        : parsed === null
          ? "null"
          : typeof parsed;

      let entryCount: number | undefined;
      if (Array.isArray(parsed)) {
        entryCount = parsed.length;
      } else if (parsed && typeof parsed === "object") {
        entryCount = Object.keys(parsed as Record<string, unknown>).length;
      }

      return {
        status: "valid",
        value: parsed,
        formatted: JSON.stringify(parsed, null, 2),
        bytes,
        characters,
        rootType,
        entryCount,
      };
    } catch (error) {
      const details = getJsonErrorDetails(debouncedInput, error);
      const baseMessage =
        "message" in (error as { message?: unknown }) && typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "Invalid JSON.";
      const { message: derivedMessage, ...rest } = details;
      return {
        status: "invalid",
        message: typeof derivedMessage === "string" ? derivedMessage : baseMessage,
        ...rest,
      };
    }
  }, [debouncedInput]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRawInput(event.target.value);
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setRawInput(reader.result);
        setFileInfo(`${file.name} · ${formatByteSize(file.size)}`);
      } else {
        setFileError("File could not be read as text.");
      }
    };
    reader.onerror = () => {
      setFileError("Failed to read file.");
    };
    reader.readAsText(file);
    event.target.value = "";
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleIndentChange = useCallback((value: string) => {
    if (isIndentOption(value)) {
      setIndentSetting(value);
    }
  }, []);

  const handleFormat = useCallback(() => {
    if (parseState.status !== "valid") {
      return;
    }
    const indent = indentSetting === "tab" ? "\t" : Number.parseInt(indentSetting, 10);
    setRawInput(JSON.stringify(parseState.value, null, indent));
  }, [indentSetting, parseState]);

  const handleMinify = useCallback(() => {
    if (parseState.status !== "valid") {
      return;
    }
    setRawInput(JSON.stringify(parseState.value));
  }, [parseState]);

  const handleCopy = useCallback(async () => {
    if (!rawInput) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(rawInput);
      setCopyState("success");
      if (copyResetRef.current) {
        clearTimeout(copyResetRef.current);
        copyResetRef.current = null;
      }
      copyResetRef.current = setTimeout(() => {
        setCopyState("idle");
        copyResetRef.current = null;
      }, 2000);
    } catch {
      setCopyState("error");
    }
  }, [rawInput]);

  const handleClear = useCallback(() => {
    setRawInput("");
    setFileInfo(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const lineCount = useMemo(() => {
    let count = 1;
    for (let i = 0; i < rawInput.length; i++) {
      if (rawInput[i] === "\n") {
        count++;
      }
    }
    return count;
  }, [rawInput]);

  const lineDigitWidth = useMemo(() => {
    return Math.max(2, String(lineCount).length);
  }, [lineCount]);

  const gutterCharacterWidth = useMemo(() => {
    return Math.max(4, lineDigitWidth + 2);
  }, [lineDigitWidth]);

  const lineNumbersText = useMemo(() => {
    return Array.from({ length: lineCount }, (_, index) =>
      String(index + 1).padStart(lineDigitWidth, " ")
    ).join("\n");
  }, [lineCount, lineDigitWidth]);

  const scrollRafRef = useRef<number | null>(null);

  const handleEditorScroll = useCallback((event: React.UIEvent<HTMLTextAreaElement>) => {
    const scrollTop = event.currentTarget.scrollTop;
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = requestAnimationFrame(() => {
      if (lineNumberContentRef.current) {
        lineNumberContentRef.current.style.transform = `translateY(${-scrollTop}px)`;
      }
    });
  }, []);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      if (lineNumberContentRef.current && textareaRef.current) {
        lineNumberContentRef.current.style.transform = `translateY(${-textareaRef.current.scrollTop}px)`;
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  const previewOutput = useMemo(() => {
    if (parseState.status !== "valid") {
      return "";
    }
    const maxLength = 6000;
    const output = parseState.formatted;
    if (output.length <= maxLength) {
      return output;
    }
    return `${output.slice(0, maxLength)}\n... truncated`;
  }, [parseState]);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">JSON Parser &amp; Linter</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Paste JSON or drop a file to validate, format, and inspect your payload. Everything runs locally in your browser.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="h-full min-w-0">
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Upload a .json file or work directly in the editor. Formatting happens client-side.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 min-w-0">
            <div className="grid gap-2">
              <Label htmlFor="json-upload">Upload JSON file</Label>
              <input
                ref={fileInputRef}
                id="json-upload"
                type="file"
                accept="application/json,.json,.har"
                onChange={handleFileChange}
                className="sr-only"
              />
              <Button type="button" onClick={openFilePicker} className="w-fit">
                {fileInfo ? "Change file" : "Choose file"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Files never leave your device; they are read with the FileReader API.
              </p>
              {fileInfo ? (
                <p className="text-xs font-medium text-foreground">Loaded {fileInfo}</p>
              ) : null}
              {fileError ? (
                <p className="text-xs text-destructive" role="alert">{fileError}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="json-input">JSON</Label>
              <div className="flex h-64 min-h-64 w-full resize-y overflow-hidden rounded-md border border-input bg-background text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] dark:bg-input/30">
                <div
                  aria-hidden
                  className="pointer-events-none flex select-none flex-col items-end border-r border-border bg-muted/40 px-3 py-2 text-xs font-mono leading-6 text-muted-foreground"
                  style={{ width: `${gutterCharacterWidth}ch` }}
                >
                  <pre
                    ref={lineNumberContentRef}
                    className="whitespace-pre leading-6 tabular-nums text-right"
                  >
                    {lineNumbersText}
                  </pre>
                </div>
                <Textarea
                  ref={textareaRef}
                  id="json-input"
                  value={rawInput}
                  onChange={handleInputChange}
                  onScroll={handleEditorScroll}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      handleFormat();
                    }
                  }}
                  spellCheck={false}
                  placeholder="Paste JSON here"
                  wrap="off"
                  style={{ whiteSpace: "pre" }}
                  className="flex-1 border-0 bg-transparent font-mono text-sm leading-6 outline-none resize-none overflow-auto focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: Press Ctrl/Cmd + Enter to format with the current indentation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                onClick={handleFormat}
                disabled={parseState.status !== "valid"}
              >
                <Wand2 className="size-4" />
                Format
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleMinify}
                disabled={parseState.status !== "valid"}
              >
                <Minimize2 className="size-4" />
                Minify
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopy}
                disabled={!rawInput}
              >
                <ClipboardCopy className="size-4" />
                {copyState === "success" ? "Copied" : "Copy input"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClear}
                disabled={!rawInput}
              >
                <Trash2 className="size-4" />
                Clear
              </Button>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Indentation</Label>
                <Select value={indentSetting} onValueChange={handleIndentChange}>
                  <SelectTrigger size="sm" aria-label="Indentation">
                    <SelectValue placeholder="Indent" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {INDENT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {indentLabels[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {copyState === "error" ? (
                <span className="text-xs text-destructive">Clipboard unavailable in this environment.</span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Validation</CardTitle>
              <CardDescription>Parsing runs automatically as you type.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 min-w-0">
              {parseState.status === "empty" ? (
                <div className="flex flex-col gap-2">
                  <Badge variant="secondary" className="w-fit">
                    <Upload className="size-4" />
                    Awaiting input
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Paste JSON or upload a file to see validation results.
                  </p>
                </div>
              ) : null}

              {parseState.status === "valid" ? (
                <div className="flex flex-col gap-4">
                  <Badge className="w-fit">
                    <CheckCircle2 className="size-4" />
                    Valid JSON
                  </Badge>
                  <dl className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Root type</dt>
                      <dd className="font-medium text-right capitalize">{parseState.rootType}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Characters</dt>
                      <dd className="font-medium text-right">{parseState.characters.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Size</dt>
                      <dd className="font-medium text-right">{formatByteSize(parseState.bytes)}</dd>
                    </div>
                    {typeof parseState.entryCount === "number" ? (
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">
                          {parseState.rootType === "array" ? "Items" : "Keys"}
                        </dt>
                        <dd className="font-medium text-right">{parseState.entryCount.toLocaleString()}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : null}

              {parseState.status === "invalid" ? (
                <div className="flex flex-col gap-3">
                  <Badge variant="destructive" className="w-fit">
                    <AlertTriangle className="size-4" />
                    Invalid JSON
                  </Badge>
                  <p className="text-sm text-destructive" role="alert">
                    {parseState.message}
                  </p>
                  {typeof parseState.line === "number" && typeof parseState.column === "number" ? (
                    <p className="text-xs text-muted-foreground">
                      Line {parseState.line}, column {parseState.column}
                    </p>
                  ) : null}
                  {parseState.pointer ? (
                    <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap wrap-break-word">
                      {parseState.pointer}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="h-full min-w-0">
            <CardHeader>
              <CardTitle>Formatted Preview</CardTitle>
              <CardDescription>Prettified output uses two-space indentation by default.</CardDescription>
            </CardHeader>
            <CardContent>
              {parseState.status === "valid" ? (
                <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/30 p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap wrap-break-word">
                  {previewOutput}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Provide valid JSON to see a formatted preview.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default JsonParserTool;
