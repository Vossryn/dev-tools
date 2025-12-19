import {
    AlertTriangle,
    CheckCircle2,
    ClipboardCopy,
    FileCode,
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
import { parseAllDocuments } from "yaml";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const INDENT_OPTIONS = ["2", "4"] as const;

type IndentOption = (typeof INDENT_OPTIONS)[number];

type DocumentSummary = {
  index: number;
  rootType: string;
  entryCount?: number;
};

type ParseState =
  | { status: "empty" }
  | {
      status: "valid";
      formatted: string;
      jsonPreviews: string[];
      characters: number;
      bytes: number;
      documentCount: number;
      summaries: DocumentSummary[];
    }
  | {
      status: "invalid";
      message: string;
      line?: number;
      column?: number;
      pointer?: string;
    };

const indentLabels: Record<IndentOption, string> = {
  "2": "2 spaces",
  "4": "4 spaces",
};

const INITIAL_SAMPLE = `name: Example
version: 1
items:
  - id: alpha
    active: true
  - id: beta
    active: false
`;

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

function extractYamlErrorDetails(source: string, error: unknown) {
  const defaultMessage = "Unable to parse YAML.";
  if (!error || typeof error !== "object") {
    return { message: defaultMessage };
  }

  const typedError = error as {
    message?: unknown;
    linePos?: Array<[number, number]>;
    pos?: number[];
    range?: { start: number } | [number, number];
    source?: {
      linePos?: Array<[number, number]>;
      range?: { start: number } | [number, number];
      pos?: number[];
    };
  };

  const message =
    typeof typedError.message === "string" && typedError.message.trim()
      ? typedError.message
      : defaultMessage;

  const primaryLinePos = typedError.linePos ?? typedError.source?.linePos;
  if (Array.isArray(primaryLinePos) && primaryLinePos.length > 0) {
    const first = primaryLinePos[0];
    if (Array.isArray(first)) {
      const [line, column] = first;
      if (typeof line === "number" && typeof column === "number") {
        return {
          message,
          line,
          column,
          ...derivePointerFromLineColumn(source, line, column),
        };
      }
    } else if (first && typeof first === "object") {
      const maybeLine = (first as { line?: unknown }).line;
      const maybeColumn = (first as { col?: unknown; column?: unknown }).col ??
        (first as { column?: unknown }).column;
      if (typeof maybeLine === "number" && typeof maybeColumn === "number") {
        return {
          message,
          line: maybeLine,
          column: maybeColumn,
          ...derivePointerFromLineColumn(source, maybeLine, maybeColumn),
        };
      }
    }
  }

  const primaryPos = typedError.pos ?? typedError.source?.pos;
  if (Array.isArray(primaryPos) && primaryPos.length > 0) {
    const position = primaryPos[0];
    if (typeof position === "number") {
      return {
        message,
        ...derivePointerFromIndex(source, position),
      };
    }
  }

  const primaryRange =
    (typedError.range ?? typedError.source?.range) as { start?: number } | [number, number] | undefined;
  if (primaryRange) {
    const start = Array.isArray(primaryRange) ? primaryRange[0] : primaryRange.start;
    if (typeof start === "number") {
      return {
        message,
        ...derivePointerFromIndex(source, start),
      };
    }
  }

  return { message };
}

function describeRoot(value: unknown) {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function deriveEntryCount(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length;
  }
  return undefined;
}

const MAX_PREVIEW_LENGTH = 6000;

function trimPreview(value: string) {
  if (value.length <= MAX_PREVIEW_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_PREVIEW_LENGTH)}\n... truncated`;
}

const YamlLinterTool: React.FC = () => {
  const [rawInput, setRawInput] = useState<string>(INITIAL_SAMPLE);
  const [indentSetting, setIndentSetting] = useState<IndentOption>("2");
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumberContentRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) {
        clearTimeout(copyResetRef.current);
        copyResetRef.current = null;
      }
    };
  }, []);

  const parseState: ParseState = useMemo(() => {
    if (!rawInput.trim()) {
      return { status: "empty" };
    }

    let documents: ReturnType<typeof parseAllDocuments>;
    try {
      documents = parseAllDocuments(rawInput, { prettyErrors: true });
    } catch (error) {
      const details = extractYamlErrorDetails(rawInput, error);
      return {
        status: "invalid",
        ...details,
      };
    }
    if (documents.length === 0) {
      return {
        status: "invalid",
        message: "No YAML documents were detected.",
      };
    }

    const erroredDocument = documents.find((doc) => doc.errors.length > 0);
    if (erroredDocument) {
      const error = erroredDocument.errors[0];
      const details = extractYamlErrorDetails(rawInput, error);
      return {
        status: "invalid",
        ...details,
      };
    }

    const indent = indentSetting === "4" ? 4 : 2;
    const formattedDocuments = documents.map((doc) => doc.toString({ indent, lineWidth: 0 }));
    const formatted = formattedDocuments.join(documents.length > 1 ? "---\n" : "").trimEnd();

    const summaries: DocumentSummary[] = documents.map((doc, index) => {
      const value = doc.toJS();
      return {
        index: index + 1,
        rootType: describeRoot(value),
        entryCount: deriveEntryCount(value),
      };
    });

    const jsonPreviews = documents.map((doc) => {
      const value = doc.toJS();
      const asJson = JSON.stringify(value, null, 2);
      return trimPreview(asJson ?? "null");
    });

    return {
      status: "valid",
      formatted,
      jsonPreviews,
      characters: rawInput.length,
      bytes: getByteSize(rawInput),
      documentCount: documents.length,
      summaries,
    };
  }, [indentSetting, rawInput]);

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
    setRawInput(parseState.formatted);
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
    return Math.max(1, rawInput.split(/\r?\n/).length);
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
  }, [rawInput]);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">YAML Linter &amp; Formatter</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Paste YAML or load a file to validate, prettify, and inspect your documents entirely in the browser.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="h-full min-w-0">
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Upload a .yml/.yaml file or work directly in the editor. Parsing happens locally.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 min-w-0">
            <div className="grid gap-2">
              <Label htmlFor="yaml-upload">Upload YAML file</Label>
              <input
                ref={fileInputRef}
                id="yaml-upload"
                type="file"
                accept=".yml,.yaml,text/yaml,application/x-yaml"
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
              <Label htmlFor="yaml-input">YAML</Label>
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
                  id="yaml-input"
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
                  placeholder="Paste YAML here"
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
              <CardDescription>Linting runs automatically as you type.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 min-w-0">
              {parseState.status === "empty" ? (
                <div className="flex flex-col gap-2">
                  <Badge variant="secondary" className="w-fit">
                    <Upload className="size-4" />
                    Awaiting input
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Paste YAML or upload a file to see validation results.
                  </p>
                </div>
              ) : null}

              {parseState.status === "valid" ? (
                <div className="flex flex-col gap-4">
                  <Badge className="w-fit">
                    <CheckCircle2 className="size-4" />
                    Valid YAML
                  </Badge>
                  <dl className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Documents</dt>
                      <dd className="font-medium text-right">{parseState.documentCount}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Characters</dt>
                      <dd className="font-medium text-right">{parseState.characters.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Size</dt>
                      <dd className="font-medium text-right">{formatByteSize(parseState.bytes)}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">Document summary</h3>
                    <ul className="grid gap-2 text-xs text-muted-foreground">
                      {parseState.summaries.map((summary) => (
                        <li key={summary.index} className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/30 px-3 py-2">
                          <span className="font-medium text-foreground">Document {summary.index}</span>
                          <span className="text-right capitalize">
                            {summary.rootType}
                            {typeof summary.entryCount === "number" ? ` · ${summary.entryCount.toLocaleString()} ${summary.rootType === "array" ? "items" : "keys"}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {parseState.status === "invalid" ? (
                <div className="flex flex-col gap-3">
                  <Badge variant="destructive" className="w-fit">
                    <AlertTriangle className="size-4" />
                    Invalid YAML
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

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Formatted YAML</CardTitle>
              <CardDescription>Pretty-printed using the selected indentation.</CardDescription>
            </CardHeader>
            <CardContent>
              {parseState.status === "valid" ? (
                <pre className="max-h-80 overflow-auto rounded-md border bg-muted/30 p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap wrap-break-word">
                  {parseState.formatted}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">Provide valid YAML to see a formatted preview.</p>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>JSON Preview</CardTitle>
              <CardDescription>Inspect the parsed documents as JSON.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {parseState.status === "valid" ? (
                parseState.jsonPreviews.map((preview, index) => (
                  <div key={index} className="flex flex-col gap-2">
                    {parseState.jsonPreviews.length > 1 ? (
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span>Document {index + 1}</span>
                        <span className="inline-flex items-center gap-1 text-foreground">
                          <FileCode className="size-4" /> JSON
                        </span>
                      </div>
                    ) : null}
                    <pre className="max-h-60 overflow-auto rounded-md border bg-muted/20 p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap wrap-break-word">
                      {preview}
                    </pre>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Valid YAML will render a JSON preview here.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default YamlLinterTool;
