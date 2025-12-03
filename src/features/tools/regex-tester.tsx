import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
    AlertTriangle,
    CheckCircle2,
    Copy,
    Link2,
    Sparkles,
    TestTube2,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

type RegexFlags = {
  g: boolean; // global
  i: boolean; // case-insensitive
  m: boolean; // multiline
  s: boolean; // dotAll
  u: boolean; // unicode
  y: boolean; // sticky
};

type MatchResult = {
  fullMatch: string;
  index: number;
  groups: string[];
  namedGroups?: Record<string, string>;
};

type ExampleTest = {
  name: string;
  pattern: string;
  flags: RegexFlags;
  testString: string;
  description: string;
};

const EXAMPLES: ExampleTest[] = [
  {
    name: "Email Validation",
    pattern: String.raw`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`,
    flags: { g: true, i: false, m: false, s: false, u: false, y: false },
    testString: "Contact us at support@example.com or sales@test.org for more info.",
    description: "Matches standard email addresses",
  },
  {
    name: "URL Matching",
    pattern: String.raw`https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)`,
    flags: { g: true, i: false, m: false, s: false, u: false, y: false },
    testString: "Visit https://www.example.com or http://test.org/path?query=value",
    description: "Matches HTTP and HTTPS URLs",
  },
  {
    name: "Phone Numbers (US)",
    pattern: String.raw`(\d{3})-(\d{3})-(\d{4})`,
    flags: { g: true, i: false, m: false, s: false, u: false, y: false },
    testString: "Call 555-123-4567 or 555-987-6543 for assistance.",
    description: "Matches US phone numbers with dashes",
  },
  {
    name: "Hex Colors",
    pattern: String.raw`#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b`,
    flags: { g: true, i: false, m: false, s: false, u: false, y: false },
    testString: "Primary: #FF5733, Secondary: #C70039, Accent: #900C3F, Light: #FFF",
    description: "Matches 3 or 6 digit hex color codes",
  },
  {
    name: "HTML Tags",
    pattern: String.raw`<([a-z]+)([^<]+)*(?:>(.*)<\/\1>|\s+\/>)`,
    flags: { g: true, i: true, m: false, s: false, u: false, y: false },
    testString: '<div class="container">Content</div><img src="image.jpg" /><p>Text</p>',
    description: "Matches HTML opening and closing tags",
  },
];

function explainRegexPattern(pattern: string): string[] {
  const explanations: string[] = [];
  
  // Common patterns and their explanations
  const patterns = [
    { regex: /\\b/g, explanation: "Word boundary - matches position between word and non-word character" },
    { regex: /\\B/g, explanation: "Non-word boundary - matches position not at word boundary" },
    { regex: /\^/g, explanation: "Start of line/string anchor" },
    { regex: /\$/g, explanation: "End of line/string anchor" },
    { regex: /\\d/g, explanation: "Digit character class - matches [0-9]" },
    { regex: /\\D/g, explanation: "Non-digit character class - matches anything except [0-9]" },
    { regex: /\\w/g, explanation: "Word character class - matches [A-Za-z0-9_]" },
    { regex: /\\W/g, explanation: "Non-word character class - matches anything except [A-Za-z0-9_]" },
    { regex: /\\s/g, explanation: "Whitespace character class - matches spaces, tabs, line breaks" },
    { regex: /\\S/g, explanation: "Non-whitespace character class" },
    { regex: /\./g, explanation: "Dot - matches any character except line breaks (unless dotAll flag is set)" },
    { regex: /\*/g, explanation: "Asterisk quantifier - matches 0 or more of the preceding token" },
    { regex: /\+/g, explanation: "Plus quantifier - matches 1 or more of the preceding token" },
    { regex: /\?/g, explanation: "Question mark - matches 0 or 1 of the preceding token (makes it optional)" },
    { regex: /\{(\d+),?(\d+)?\}/g, explanation: "Quantifier - matches specific number of repetitions" },
    { regex: /\[([^\]]+)\]/g, explanation: "Character class - matches any single character from the set" },
    { regex: /\(([^)]+)\)/g, explanation: "Capturing group - captures the matched text for later use" },
    { regex: /\(\?:([^)]+)\)/g, explanation: "Non-capturing group - groups tokens without capturing" },
    { regex: /\|/g, explanation: "Alternation - acts like a boolean OR" },
  ];

  // Check for common patterns
  if (pattern.includes("\\b")) {
    explanations.push("🔹 Uses word boundaries to match whole words only");
  }
  if (pattern.includes("^") || pattern.includes("$")) {
    explanations.push("🔹 Anchored to start/end of line or string");
  }
  if (pattern.match(/\((?!\?:)/)) {
    explanations.push("🔹 Contains capturing groups to extract parts of the match");
  }
  if (pattern.includes("+") || pattern.includes("*") || pattern.includes("{")) {
    explanations.push("🔹 Uses quantifiers to match repeated patterns");
  }
  if (pattern.includes("[")) {
    explanations.push("🔹 Uses character classes to match specific character sets");
  }
  if (pattern.includes("|")) {
    explanations.push("🔹 Uses alternation to match multiple patterns");
  }
  if (pattern.includes("\\d") || pattern.includes("\\w") || pattern.includes("\\s")) {
    explanations.push("🔹 Uses shorthand character classes for common patterns");
  }

  // Add general structure explanation
  if (explanations.length === 0) {
    explanations.push("🔹 Simple literal pattern matching");
  }

  return explanations;
}

function buildRegexFromFlags(pattern: string, flags: RegexFlags): RegExp | null {
  try {
    const flagString = Object.entries(flags)
      .filter(([_, enabled]) => enabled)
      .map(([flag]) => flag)
      .join("");
    return new RegExp(pattern, flagString);
  } catch {
    return null;
  }
}

function findMatches(pattern: string, flags: RegexFlags, testString: string): MatchResult[] | null {
  const regex = buildRegexFromFlags(pattern, flags);
  if (!regex) return null;

  const matches: MatchResult[] = [];
  
  if (flags.g) {
    // Global flag - use matchAll
    const matchIterator = testString.matchAll(regex);
    for (const match of matchIterator) {
      matches.push({
        fullMatch: match[0],
        index: match.index ?? 0,
        groups: match.slice(1),
        namedGroups: match.groups,
      });
    }
  } else {
    // Non-global - use exec once
    const match = regex.exec(testString);
    if (match) {
      matches.push({
        fullMatch: match[0],
        index: match.index,
        groups: match.slice(1),
        namedGroups: match.groups,
      });
    }
  }

  return matches;
}

function encodeShareableUrl(pattern: string, flags: RegexFlags, testString: string): string {
  const flagString = Object.entries(flags)
    .filter(([_, enabled]) => enabled)
    .map(([flag]) => flag)
    .join("");
  
  const params = new URLSearchParams({
    pattern,
    flags: flagString,
    test: testString,
  });
  
  // Only access window in browser environment
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}#${params.toString()}`;
}

function decodeShareableUrl(): { pattern: string; flags: RegexFlags; testString: string } | null {
  // Only access window in browser environment
  if (typeof window === "undefined") return null;
  
  const hash = window.location.hash.slice(1);
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const pattern = params.get("pattern");
  const flagString = params.get("flags") || "";
  const testString = params.get("test");

  if (!pattern || !testString) return null;

  const flags: RegexFlags = {
    g: flagString.includes("g"),
    i: flagString.includes("i"),
    m: flagString.includes("m"),
    s: flagString.includes("s"),
    u: flagString.includes("u"),
    y: flagString.includes("y"),
  };

  return { pattern, flags, testString };
}

const RegexTester: React.FC = () => {
  const [pattern, setPattern] = useState("");
  const [testString, setTestString] = useState("");
  const [flags, setFlags] = useState<RegexFlags>({
    g: true,
    i: false,
    m: false,
    s: false,
    u: false,
    y: false,
  });
  const [copyState, setCopyState] = useState<"idle" | "success">("idle");

  // Load from URL on mount
  useEffect(() => {
    const shared = decodeShareableUrl();
    if (shared) {
      setPattern(shared.pattern);
      setFlags(shared.flags);
      setTestString(shared.testString);
    }
  }, []);

  const toggleFlag = useCallback((flag: keyof RegexFlags) => {
    setFlags((prev) => ({ ...prev, [flag]: !prev[flag] }));
  }, []);

  const loadExample = useCallback((example: ExampleTest) => {
    setPattern(example.pattern);
    setFlags(example.flags);
    setTestString(example.testString);
  }, []);

  const handleShare = useCallback(async () => {
    const url = encodeShareableUrl(pattern, flags, testString);
    if (!url) return; // Guard for SSR
    
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setCopyState("success");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", url);
      }
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      // Fallback: just update URL
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", url);
      }
      setCopyState("success");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }, [pattern, flags, testString]);

  const regexError = useMemo(() => {
    if (!pattern) return null;
    try {
      buildRegexFromFlags(pattern, flags);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid regex pattern";
    }
  }, [pattern, flags]);

  const matches = useMemo(() => {
    if (!pattern || !testString || regexError) return null;
    return findMatches(pattern, flags, testString);
  }, [pattern, flags, testString, regexError]);

  const explanation = useMemo(() => {
    if (!pattern || regexError) return [];
    return explainRegexPattern(pattern);
  }, [pattern, regexError]);

  const highlightedText = useMemo(() => {
    if (!matches || matches.length === 0) return testString;

    const parts: { text: string; isMatch: boolean; matchIndex?: number }[] = [];
    let lastIndex = 0;

    matches.forEach((match, idx) => {
      if (match.index > lastIndex) {
        parts.push({ text: testString.slice(lastIndex, match.index), isMatch: false });
      }
      parts.push({ text: match.fullMatch, isMatch: true, matchIndex: idx });
      lastIndex = match.index + match.fullMatch.length;
    });

    if (lastIndex < testString.length) {
      parts.push({ text: testString.slice(lastIndex), isMatch: false });
    }

    return parts;
  }, [matches, testString]);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Regex Tester</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Test regular expressions in real-time with pattern explanations and shareable test cases. Perfect for debugging and learning regex patterns.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Pattern</CardTitle>
              <CardDescription>
                Enter your regular expression pattern and configure flags.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="pattern">Regex Pattern</Label>
                <Input
                  id="pattern"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="Enter regex pattern..."
                  className="font-mono"
                  spellCheck={false}
                />
                {regexError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="text-sm text-destructive">{regexError}</p>
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <Label>Flags</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(Object.keys(flags) as Array<keyof RegexFlags>).map((flag) => (
                    <div key={flag} className="flex items-center gap-2">
                      <Switch
                        id={`flag-${flag}`}
                        checked={flags[flag]}
                        onCheckedChange={() => toggleFlag(flag)}
                      />
                      <Label
                        htmlFor={`flag-${flag}`}
                        className="text-sm font-mono cursor-pointer"
                      >
                        {flag}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {flag === "g" && "(global)"}
                        {flag === "i" && "(ignore case)"}
                        {flag === "m" && "(multiline)"}
                        {flag === "s" && "(dotAll)"}
                        {flag === "u" && "(unicode)"}
                        {flag === "y" && "(sticky)"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test String</CardTitle>
              <CardDescription>
                Enter the text you want to test your regex pattern against.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="test-string">Input Text</Label>
                <Textarea
                  id="test-string"
                  value={testString}
                  onChange={(e) => setTestString(e.target.value)}
                  placeholder="Enter test string..."
                  className="font-mono min-h-32 resize-y"
                  spellCheck={false}
                />
              </div>

              {testString && !regexError && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Highlighted Matches</span>
                    {matches && matches.length > 0 && (
                      <Badge variant="default">
                        {matches.length} {matches.length === 1 ? "match" : "matches"}
                      </Badge>
                    )}
                  </div>
                  <div className="font-mono text-sm whitespace-pre-wrap break-words">
                    {Array.isArray(highlightedText) ? (
                      highlightedText.map((part, idx) =>
                        part.isMatch ? (
                          <mark
                            key={idx}
                            className="bg-yellow-300 dark:bg-yellow-600 px-1 rounded"
                          >
                            {part.text}
                          </mark>
                        ) : (
                          <span key={idx}>{part.text}</span>
                        )
                      )
                    ) : (
                      <span className="text-muted-foreground">{highlightedText}</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Match Details</CardTitle>
              <CardDescription>
                Detailed information about each match and capture groups.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!pattern || !testString ? (
                <p className="text-sm text-muted-foreground">
                  Enter a pattern and test string to see match details.
                </p>
              ) : regexError ? (
                <p className="text-sm text-destructive">
                  Fix the regex error to see matches.
                </p>
              ) : !matches || matches.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm">No matches found</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {matches.map((match, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border bg-muted/20 p-4 grid gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Match {idx + 1}</span>
                        <Badge variant="outline" className="font-mono text-xs">
                          Index: {match.index}
                        </Badge>
                      </div>
                      <div className="grid gap-2">
                        <div className="flex gap-2">
                          <span className="text-sm text-muted-foreground min-w-20">Full match:</span>
                          <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                            {match.fullMatch}
                          </code>
                        </div>
                        {match.groups.length > 0 && (
                          <div className="grid gap-1.5 mt-2">
                            <span className="text-sm font-medium">Capture Groups:</span>
                            {match.groups.map((group, groupIdx) => (
                              <div key={groupIdx} className="flex gap-2 ml-4">
                                <span className="text-sm text-muted-foreground min-w-16">
                                  Group {groupIdx + 1}:
                                </span>
                                <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                                  {group || "(empty)"}
                                </code>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Pattern Explanation
              </CardTitle>
              <CardDescription>
                Understanding your regex pattern
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!pattern ? (
                <p className="text-sm text-muted-foreground">
                  Enter a pattern to see an explanation.
                </p>
              ) : regexError ? (
                <p className="text-sm text-destructive">
                  Fix the regex error to see explanation.
                </p>
              ) : (
                <div className="grid gap-2">
                  {explanation.map((line, idx) => (
                    <p key={idx} className="text-sm leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube2 className="h-5 w-5" />
                Examples
              </CardTitle>
              <CardDescription>
                Common regex patterns to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="examples" className="w-full">
                <TabsList className="grid w-full grid-cols-1">
                  <TabsTrigger value="examples">Load Example</TabsTrigger>
                </TabsList>
                <TabsContent value="examples" className="grid gap-2 mt-4">
                  {EXAMPLES.map((example) => (
                    <Button
                      key={example.name}
                      variant="outline"
                      className="justify-start h-auto py-3 px-4"
                      onClick={() => loadExample(example)}
                    >
                      <div className="grid gap-1 text-left">
                        <span className="font-medium text-sm">{example.name}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          {example.description}
                        </span>
                      </div>
                    </Button>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Share
              </CardTitle>
              <CardDescription>
                Share your regex test case
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button
                onClick={handleShare}
                disabled={!pattern || !testString || !!regexError}
                className="w-full"
              >
                {copyState === "success" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    URL Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Shareable URL
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Creates a URL with your pattern and test string encoded in the hash. Share it with others or bookmark it for later.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default RegexTester;
