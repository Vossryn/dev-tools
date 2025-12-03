import DOMPurify from "dompurify";
import {
  CheckCircle2,
  ClipboardCopy,
  Code2,
  Download,
  FileText,
  Trash2,
} from "lucide-react";
import { marked } from "marked";
import React, { useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Textarea } from "@/components/ui/textarea";

// Configure marked for GitHub Flavored Markdown
marked.setOptions({
    gfm: true,
    breaks: true,
});

const INITIAL_MARKDOWN = `# Markdown Preview

Welcome to the **Markdown Preview** tool! This is a side-by-side editor where you can write markdown and see the rendered HTML in real-time.

## Features

- ✨ Live preview as you type
- 📝 GitHub Flavored Markdown support
- 💾 Export as .md or .html files
- 📋 Copy markdown or HTML to clipboard
- 🎨 Clean, responsive interface

## Examples

### Lists

**Unordered:**
- Item one
- Item two
  - Nested item
  - Another nested item

**Ordered:**
1. First item
2. Second item
3. Third item

### Code Blocks

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("World");
\`\`\`

### Tables

| Feature | Supported |
|---------|-----------|
| Tables | ✅ |
| Task Lists | ✅ |
| Strikethrough | ✅ |

### Task Lists

- [x] Create markdown editor
- [x] Add live preview
- [ ] Add more features

### Blockquotes

> "The best way to predict the future is to invent it."
> — Alan Kay

### Links and Images

[Visit GitHub](https://github.com)

---

**Try editing this text to see the preview update in real-time!**
`;

const EXAMPLE_TEMPLATES = [
    {
        name: "README Template",
        content: `# Project Name

## Description
A brief description of your project.

## Installation
\`\`\`bash
npm install project-name
\`\`\`

## Usage
\`\`\`javascript
import { feature } from 'project-name';
\`\`\`

## Contributing
Pull requests are welcome!

## License
MIT
`,
    },
    {
        name: "Documentation",
        content: `# API Documentation

## Overview
This API provides access to...

## Authentication
\`\`\`http
Authorization: Bearer YOUR_TOKEN
\`\`\`

## Endpoints

### GET /api/resource
Retrieves a list of resources.

**Parameters:**
- \`limit\` (optional): Number of items to return
- \`offset\` (optional): Pagination offset

**Response:**
\`\`\`json
{
  "data": [],
  "total": 0
}
\`\`\`
`,
    },
    {
        name: "Meeting Notes",
        content: `# Meeting Notes - [Date]

## Attendees
- Person 1
- Person 2
- Person 3

## Agenda
1. Topic one
2. Topic two
3. Topic three

## Discussion

### Topic One
- Key point
- Decision made
- Action items

## Action Items
- [ ] Task 1 - @assignee
- [ ] Task 2 - @assignee
- [ ] Task 3 - @assignee

## Next Meeting
Date: TBD
`,
    },
];

type CopyState = "idle" | "success" | "error";

const MarkdownPreviewTool: React.FC = () => {
    const [markdown, setMarkdown] = useState<string>(INITIAL_MARKDOWN);
    const [copyMarkdownState, setCopyMarkdownState] = useState<CopyState>("idle");
    const [copyHtmlState, setCopyHtmlState] = useState<CopyState>("idle");
    const copyMarkdownResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const copyHtmlResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const renderedHtml = useMemo(() => {
        const rawHtml = marked.parse(markdown) as string;
        return DOMPurify.sanitize(rawHtml);
    }, [markdown]);

    const stats = useMemo(() => {
        const characters = markdown.length;
        const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
        const lines = markdown.split(/\r?\n/).length;
        return { characters, words, lines };
    }, [markdown]);

    const handleMarkdownChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMarkdown(event.target.value);
    }, []);

    const handleCopyMarkdown = useCallback(async () => {
        if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
            setCopyMarkdownState("error");
            return;
        }

        try {
            await navigator.clipboard.writeText(markdown);
            setCopyMarkdownState("success");
            if (copyMarkdownResetRef.current) {
                clearTimeout(copyMarkdownResetRef.current);
            }
            copyMarkdownResetRef.current = setTimeout(() => {
                setCopyMarkdownState("idle");
            }, 2000);
        } catch {
            setCopyMarkdownState("error");
        }
    }, [markdown]);

    const handleCopyHtml = useCallback(async () => {
        if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
            setCopyHtmlState("error");
            return;
        }

        try {
            await navigator.clipboard.writeText(renderedHtml);
            setCopyHtmlState("success");
            if (copyHtmlResetRef.current) {
                clearTimeout(copyHtmlResetRef.current);
            }
            copyHtmlResetRef.current = setTimeout(() => {
                setCopyHtmlState("idle");
            }, 2000);
        } catch {
            setCopyHtmlState("error");
        }
    }, [renderedHtml]);

    const handleDownloadMarkdown = useCallback(() => {
        const blob = new Blob([markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "document.md";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [markdown]);

    const handleDownloadHtml = useCallback(() => {
        const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown Document</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
        }
        code {
            background: #f4f4f4;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        pre {
            background: #f4f4f4;
            padding: 1rem;
            border-radius: 5px;
            overflow-x: auto;
        }
        pre code {
            background: none;
            padding: 0;
        }
        blockquote {
            border-left: 4px solid #ddd;
            margin: 0;
            padding-left: 1rem;
            color: #666;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 1rem 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 0.5rem;
            text-align: left;
        }
        th {
            background: #f4f4f4;
        }
        img {
            max-width: 100%;
            height: auto;
        }
    </style>
</head>
<body>
${renderedHtml}
</body>
</html>`;

        const blob = new Blob([fullHtml], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "document.html";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [renderedHtml]);

    const handleClear = useCallback(() => {
        setMarkdown("");
    }, []);

    const loadTemplate = useCallback((template: string) => {
        setMarkdown(template);
    }, []);

    return (
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold">Markdown Preview</h1>
                <p className="text-muted-foreground max-w-3xl text-sm">
                    Side-by-side Markdown editor with live preview and HTML export. Perfect for creating documentation, README files, and formatted text snippets.
                </p>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Editor & Preview</CardTitle>
                        <CardDescription>
                            Write markdown on the left and see the rendered output on the right.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-4">
                        <ResizablePanelGroup direction="horizontal" className="min-h-[600px] rounded-lg border">
                            <ResizablePanel defaultSize={50} minSize={30}>
                                <div className="flex h-full flex-col">
                                    <div className="border-b bg-muted/40 px-4 py-2">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">Markdown</span>
                                        </div>
                                    </div>
                                    <Textarea
                                        value={markdown}
                                        onChange={handleMarkdownChange}
                                        placeholder="Write your markdown here..."
                                        className="flex-1 border-0 font-mono text-sm resize-none rounded-none focus-visible:ring-0"
                                        spellCheck={false}
                                    />
                                </div>
                            </ResizablePanel>
                            <ResizableHandle withHandle />
                            <ResizablePanel defaultSize={50} minSize={30}>
                                <div className="flex h-full flex-col">
                                    <div className="border-b bg-muted/40 px-4 py-2">
                                        <div className="flex items-center gap-2">
                                            <Code2 className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">Preview</span>
                                        </div>
                                    </div>
                                    <div
                                        className="flex-1 overflow-auto p-4 prose prose-sm dark:prose-invert max-w-none"
                                        dangerouslySetInnerHTML={{ __html: renderedHtml }}
                                    />
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleCopyMarkdown}
                                disabled={!markdown}
                            >
                                <ClipboardCopy className="size-4" />
                                {copyMarkdownState === "success" ? "Copied!" : "Copy Markdown"}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleCopyHtml}
                                disabled={!markdown}
                            >
                                <ClipboardCopy className="size-4" />
                                {copyHtmlState === "success" ? "Copied!" : "Copy HTML"}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleDownloadMarkdown}
                                disabled={!markdown}
                            >
                                <Download className="size-4" />
                                Download .md
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleDownloadHtml}
                                disabled={!markdown}
                            >
                                <Download className="size-4" />
                                Download .html
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={handleClear}
                                disabled={!markdown}
                            >
                                <Trash2 className="size-4" />
                                Clear
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Statistics</CardTitle>
                            <CardDescription>Document metrics</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-2 text-sm">
                                <div className="flex justify-between gap-4">
                                    <dt className="text-muted-foreground">Characters</dt>
                                    <dd className="font-medium text-right">{stats.characters.toLocaleString()}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <dt className="text-muted-foreground">Words</dt>
                                    <dd className="font-medium text-right">{stats.words.toLocaleString()}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <dt className="text-muted-foreground">Lines</dt>
                                    <dd className="font-medium text-right">{stats.lines.toLocaleString()}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Templates</CardTitle>
                            <CardDescription>Quick-start with common formats</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-2">
                            {EXAMPLE_TEMPLATES.map((template) => (
                                <Button
                                    key={template.name}
                                    variant="outline"
                                    className="justify-start h-auto py-3 px-4"
                                    onClick={() => loadTemplate(template.content)}
                                >
                                    <div className="grid gap-1 text-left">
                                        <span className="font-medium text-sm">{template.name}</span>
                                    </div>
                                </Button>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Features</CardTitle>
                            <CardDescription>GitHub Flavored Markdown</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="grid gap-2 text-sm">
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span>Tables</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span>Task lists</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span>Strikethrough</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span>Code blocks</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span>Auto-linking</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    );
};

export default MarkdownPreviewTool;
