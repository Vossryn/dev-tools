import { minify as minifyWithCsso } from "csso";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Minimize2,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import postcss, { CssSyntaxError, type Declaration, type Root } from "postcss";
import postcssNesting from "postcss-nesting";
import parserPostcss from "prettier/plugins/postcss";
import prettier from "prettier/standalone";
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

type CssStats = {
  ruleCount: number;
  declarationCount: number;
  atRuleCount: number;
  nestedRuleCount: number;
  selectorCount: number;
  customPropertyCount: number;
};

type ParseState =
  | { status: "empty" }
  | {
      status: "valid";
      bytes: number;
      characters: number;
      stats: CssStats;
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
  tab: "Tab character",
};

const INITIAL_SAMPLE = `:root {
  --brand-color: #2563eb;
  color-scheme: light dark;
}

.card {
  display: grid;
  gap: 1rem;

  & > header {
    font-size: 1.125rem;
    font-weight: 600;
  }

  & .actions {
    display: flex;
    gap: 0.75rem;

    button {
      border-radius: 999px;
      &:hover {
        background: color-mix(in srgb, var(--brand-color) 85%, transparent);
      }
    }
  }

  @media (width >= 48rem) {
    grid-template-columns: 1fr auto;
  }
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
  const rounded =
    unitIndex === 0 ? Math.round(value) : Number(value.toFixed(value >= 10 ? 0 : 1));
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

function getCssErrorDetails(source: string, error: unknown) {
  const fallback = "Unable to parse CSS.";

  if (error instanceof CssSyntaxError) {
    const message = typeof error.reason === "string" ? error.reason : fallback;
    const details: {
      message: string;
      line?: number;
      column?: number;
      pointer?: string;
    } = {
      message,
    };

    if (typeof error.line === "number" && typeof error.column === "number") {
      details.line = error.line;
      details.column = error.column;
      details.pointer = buildPointerSnippet(source, error.line, error.column);
    }

    return details;
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return { message: error.message };
  }

  return { message: fallback };
}

function computeCssStats(root: Root): CssStats {
  let ruleCount = 0;
  let declarationCount = 0;
  let atRuleCount = 0;
  let nestedRuleCount = 0;
  let selectorCount = 0;
  let customPropertyCount = 0;

  root.walkRules((rule) => {
    ruleCount += 1;
    if (rule.parent && rule.parent.type !== "root") {
      nestedRuleCount += 1;
    }

    const selectors = rule.selector
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean);
    selectorCount += selectors.length || 1;
  });

  root.walkDecls((decl: Declaration) => {
    declarationCount += 1;
    if (decl.prop.startsWith("--")) {
      customPropertyCount += 1;
    }
  });

  root.walkAtRules(() => {
    atRuleCount += 1;
  });

  return {
    ruleCount,
    declarationCount,
    atRuleCount,
    nestedRuleCount,
    selectorCount,
    customPropertyCount,
  };
}

async function formatCss(input: string, indent: IndentOption) {
  const tabWidth = indent === "tab" ? 2 : Number.parseInt(indent, 10);
  const formatted = await prettier.format(input, {
    parser: "css",
    plugins: [parserPostcss],
    tabWidth,
    useTabs: indent === "tab",
    printWidth: 100,
  });
  return formatted.trimEnd();
}

async function normalizeCssWithNesting(input: string) {
  const result = await postcss([postcssNesting()]).process(input, { from: undefined });
  return result.css;
}

async function minifyCss(input: string) {
  const normalized = await normalizeCssWithNesting(input);
  return minifyWithCsso(normalized).css;
}

const CssParserTool: React.FC = () => {
  const [rawInput, setRawInput] = useState<string>(INITIAL_SAMPLE);
  const [indentSetting, setIndentSetting] = useState<IndentOption>("2");
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [isMinifying, setIsMinifying] = useState<boolean>(false);
  const [previewOutput, setPreviewOutput] = useState<string>("");
  const [previewError, setPreviewError] = useState<string | null>(null);
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
      const root = postcss.parse(debouncedInput, { from: undefined });
      const characters = debouncedInput.length;
      const bytes = getByteSize(debouncedInput);
      const stats = computeCssStats(root);

      return {
        status: "valid",
        bytes,
        characters,
        stats,
      };
    } catch (error) {
      const details = getCssErrorDetails(debouncedInput, error);
      return {
        status: "invalid",
        ...details,
      };
    }
  }, [debouncedInput]);

  useEffect(() => {
    let cancelled = false;

    if (parseState.status !== "valid") {
      setPreviewOutput("");
      setPreviewError(null);
      return;
    }

    (async () => {
      try {
        const formatted = await formatCss(debouncedInput, "2");
        if (cancelled) {
          return;
        }
        const maxLength = 6000;
        const output = formatted.length > maxLength ? `${formatted.slice(0, maxLength)}\n... truncated` : formatted;
        setPreviewOutput(output);
        setPreviewError(null);
      } catch {
        if (!cancelled) {
          setPreviewOutput("");
          setPreviewError("Unable to generate preview.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parseState, debouncedInput]);

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

  const handleFormat = useCallback(async () => {
    if (parseState.status !== "valid" || isFormatting) {
      return;
    }

    setIsFormatting(true);
    setActionError(null);
    try {
      const formatted = await formatCss(rawInput, indentSetting);
      setRawInput(formatted);
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : "Unable to format CSS.";
      setActionError(message);
    } finally {
      setIsFormatting(false);
    }
  }, [indentSetting, isFormatting, parseState, rawInput]);

  const handleMinify = useCallback(async () => {
    if (parseState.status !== "valid" || isMinifying) {
      return;
    }

    setIsMinifying(true);
    setActionError(null);
    try {
      const minified = await minifyCss(rawInput);
      setRawInput(minified);
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : "Unable to minify CSS.";
      setActionError(message);
    } finally {
      setIsMinifying(false);
    }
  }, [isMinifying, parseState, rawInput]);

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
    setActionError(null);
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

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">CSS Parser, Linter &amp; Formatter</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Paste CSS or upload a stylesheet to validate, format, and inspect your styles. Nested CSS is supported out of the box and everything runs locally in your browser.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="h-full min-w-0">
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Upload a .css file or edit directly in the browser-based editor.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 min-w-0">
            <div className="grid gap-2">
              <Label htmlFor="css-upload">Upload CSS file</Label>
              <input
                ref={fileInputRef}
                id="css-upload"
                type="file"
                accept="text/css,.css"
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
              <Label htmlFor="css-input">CSS</Label>
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
                  id="css-input"
                  value={rawInput}
                  onChange={handleInputChange}
                  onScroll={handleEditorScroll}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void handleFormat();
                    }
                  }}
                  spellCheck={false}
                  placeholder="Paste CSS here"
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
                onClick={() => void handleFormat()}
                disabled={parseState.status !== "valid" || isFormatting}
              >
                <Wand2 className="size-4" />
                {isFormatting ? "Formatting" : "Format"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleMinify()}
                disabled={parseState.status !== "valid" || isMinifying}
              >
                <Minimize2 className="size-4" />
                {isMinifying ? "Minifying" : "Minify"}
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
              {actionError ? (
                <span className="text-xs text-destructive" role="alert">
                  {actionError}
                </span>
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
                    Paste CSS or upload a file to see validation results.
                  </p>
                </div>
              ) : null}

              {parseState.status === "valid" ? (
                <div className="flex flex-col gap-4">
                  <Badge className="w-fit">
                    <CheckCircle2 className="size-4" />
                    Valid CSS
                  </Badge>
                  <dl className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Characters</dt>
                      <dd className="font-medium text-right">{parseState.characters.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Size</dt>
                      <dd className="font-medium text-right">{formatByteSize(parseState.bytes)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Rules</dt>
                      <dd className="font-medium text-right">{parseState.stats.ruleCount.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Declarations</dt>
                      <dd className="font-medium text-right">{parseState.stats.declarationCount.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Nested rules</dt>
                      <dd className="font-medium text-right">{parseState.stats.nestedRuleCount.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">At-rules</dt>
                      <dd className="font-medium text-right">{parseState.stats.atRuleCount.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Selectors</dt>
                      <dd className="font-medium text-right">{parseState.stats.selectorCount.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Custom properties</dt>
                      <dd className="font-medium text-right">{parseState.stats.customPropertyCount.toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {parseState.status === "invalid" ? (
                <div className="flex flex-col gap-3">
                  <Badge variant="destructive" className="w-fit">
                    <AlertTriangle className="size-4" />
                    Invalid CSS
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
              <CardDescription>Preview uses Prettier with two-space indentation by default.</CardDescription>
            </CardHeader>
            <CardContent>
              {parseState.status === "valid" ? (
                previewError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {previewError}
                  </p>
                ) : previewOutput ? (
                  <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/30 p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap wrap-break-word">
                    {previewOutput}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Generating preview...
                  </p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  Provide valid CSS to see a formatted preview.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default CssParserTool;
