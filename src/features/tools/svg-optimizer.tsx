import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Download, Sparkles, Upload, Wand2, Zap } from "lucide-react";
import type {
  Config as OptimizeOptions,
  PluginConfig,
  PresetDefaultOverrides,
} from "svgo";
import { optimize } from "svgo/browser";

type PresetId = "balanced" | "presentation" | "aggressive";

type Preset = {
  id: PresetId;
  label: string;
  description: string;
  buildOptions: (overrides: PresetOverrides) => OptimizeOptions;
};

type PresetOverrides = {
  preserveViewBox: boolean;
  preserveIds: boolean;
  prettyOutput: boolean;
};

const PRESETS: Preset[] = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Multipass optimization with safe defaults and preserved viewBox.",
    buildOptions: ({ preserveViewBox, preserveIds, prettyOutput }) => {
      const presetOverrides: PresetDefaultOverrides = {};

      if (preserveIds) {
        presetOverrides.cleanupIds = false;
      }

      const plugins: PluginConfig[] = [];

      if (Object.keys(presetOverrides).length > 0) {
        plugins.push({
          name: "preset-default",
          params: { overrides: presetOverrides },
        });
      } else {
        plugins.push("preset-default");
      }

      if (!preserveViewBox) {
        plugins.push("removeViewBox");
      }

      plugins.push("removeDimensions");

      return {
        multipass: true,
        plugins,
        js2svg: { pretty: prettyOutput, indent: 2 },
      } satisfies OptimizeOptions;
    },
  },
  {
    id: "presentation",
    label: "Presentation",
    description: "Keep path fidelity for hand-tuned artwork while trimming metadata.",
    buildOptions: ({ preserveViewBox, preserveIds, prettyOutput }) => {
      const presetOverrides: PresetDefaultOverrides = {
        convertPathData: false,
        convertShapeToPath: false,
      };

      if (preserveIds) {
        presetOverrides.cleanupIds = false;
      }

      const plugins: PluginConfig[] = [
        {
          name: "preset-default",
          params: { overrides: presetOverrides },
        },
      ];

      if (!preserveViewBox) {
        plugins.push("removeViewBox");
      }

      plugins.push("removeDimensions");
      plugins.push("sortAttrs");

      return {
        multipass: false,
        plugins,
        js2svg: { pretty: prettyOutput, indent: 2 },
      } satisfies OptimizeOptions;
    },
  },
  {
    id: "aggressive",
    label: "Aggressive",
    description: "Maximum compression—ideal for exported icon sets and generated assets.",
    buildOptions: ({ preserveViewBox, preserveIds, prettyOutput }) => {
      const presetOverrides: PresetDefaultOverrides = {
        cleanupNumericValues: {
          floatPrecision: 2,
        },
      };

      if (preserveIds) {
        presetOverrides.cleanupIds = false;
      }

      const plugins: PluginConfig[] = [
        {
          name: "preset-default",
          params: { overrides: presetOverrides },
        },
      ];

      if (!preserveViewBox) {
        plugins.push("removeViewBox");
      }

      plugins.push("removeDimensions");
      plugins.push("convertPathData");
      plugins.push("mergePaths");

      return {
        multipass: true,
        floatPrecision: 2,
        plugins,
        js2svg: { pretty: prettyOutput, indent: 2 },
      } satisfies OptimizeOptions;
    },
  },
];

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const thresholds = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    thresholds.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value > 10 ? 0 : 1)} ${thresholds[index]}`;
}

function sanitizeFileName(raw: string) {
  const candidate = raw.replace(/\.[^.]+$/, "");
  const cleaned = candidate.replace(/[\\/:*?"<>|]+/g, " ");
  const condensed = cleaned.replace(/\s+/g, " ").trim();
  return condensed || "optimized";
}

export default function SvgOptimizer() {
  const [sourceSvg, setSourceSvg] = useState("");
  const [optimizedSvg, setOptimizedSvg] = useState("");
  const [activePresetId, setActivePresetId] = useState<PresetId>("balanced");
  const [preserveViewBox, setPreserveViewBox] = useState(true);
  const [preserveIds, setPreserveIds] = useState(true);
  const [prettyOutput, setPrettyOutput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState("optimized");
  const [uploadedFileInfo, setUploadedFileInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const optimizeTokenRef = useRef(0);

  const activePreset = useMemo(
    () => PRESETS.find((preset) => preset.id === activePresetId) ?? PRESETS[0],
    [activePresetId]
  );

  const overrides = useMemo<PresetOverrides>(
    () => ({ preserveViewBox, preserveIds, prettyOutput }),
    [preserveViewBox, preserveIds, prettyOutput]
  );

  const optimizedUrl = useMemo(() => {
    if (!optimizedSvg) {
      return null;
    }
    const blob = new Blob([optimizedSvg], { type: "image/svg+xml" });
    return URL.createObjectURL(blob);
  }, [optimizedSvg]);

  useEffect(() => {
    return () => {
      if (optimizedUrl) {
        URL.revokeObjectURL(optimizedUrl);
      }
    };
  }, [optimizedUrl]);

  // Debounce optimization so typing in the textarea stays responsive.
  useEffect(() => {
    if (!sourceSvg.trim()) {
      setOptimizedSvg("");
      setIsProcessing(false);
      setError(null);
      return;
    }

    const token = optimizeTokenRef.current + 1;
    optimizeTokenRef.current = token;
    setIsProcessing(true);
    setError(null);

    const timeoutId = window.setTimeout(() => {
      try {
        const result = optimize(sourceSvg, activePreset.buildOptions(overrides));
        if (optimizeTokenRef.current !== token) {
          return;
        }
        setOptimizedSvg(typeof result === "string" ? result : result.data);
      } catch (optimizationError) {
        if (optimizeTokenRef.current !== token) {
          return;
        }
        console.error(optimizationError);
        setError(
          optimizationError instanceof Error
            ? optimizationError.message
            : "Failed to optimize SVG."
        );
        setOptimizedSvg("");
      } finally {
        if (optimizeTokenRef.current === token) {
          setIsProcessing(false);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [sourceSvg, activePreset, overrides]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeoutId = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const originalBytes = useMemo(() => {
    if (!sourceSvg) {
      return 0;
    }
    return new Blob([sourceSvg], { type: "image/svg+xml" }).size;
  }, [sourceSvg]);

  const optimizedBytes = useMemo(() => {
    if (!optimizedSvg) {
      return 0;
    }
    return new Blob([optimizedSvg], { type: "image/svg+xml" }).size;
  }, [optimizedSvg]);

  const savings = useMemo(() => {
    if (!originalBytes || !optimizedBytes || optimizedBytes >= originalBytes) {
      return null;
    }
    const delta = originalBytes - optimizedBytes;
    const percent = (delta / originalBytes) * 100;
    return { delta, percent };
  }, [originalBytes, optimizedBytes]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        setUploadedFileInfo(null);
        return;
      }
      if (!file.type.includes("svg")) {
        setError("Please choose an SVG file.");
        setUploadedFileInfo(null);
        return;
      }
      try {
        const text = await file.text();
        setSourceSvg(text);
        setFileName(sanitizeFileName(file.name));
        setUploadedFileInfo(`${file.name} · ${formatBytes(file.size)}`);
        setError(null);
      } catch (readError) {
        console.error(readError);
        setError(
          readError instanceof Error
            ? readError.message
            : "Unable to read the selected file."
        );
        setUploadedFileInfo(null);
      }
    },
    []
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleCopyOptimized = useCallback(async () => {
    if (!optimizedSvg) {
      return;
    }
    try {
      await navigator.clipboard.writeText(optimizedSvg);
      setCopied(true);
    } catch (clipboardError) {
      console.error(clipboardError);
      setError(
        clipboardError instanceof Error
          ? clipboardError.message
          : "Clipboard copy failed."
      );
    }
  }, [optimizedSvg]);

  const clearAll = useCallback(() => {
    setSourceSvg("");
    setOptimizedSvg("");
    setFileName("optimized");
    setUploadedFileInfo(null);
    setError(null);
  }, []);

  const descriptionByPreset = useMemo(() => activePreset.description, [activePreset]);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">SVG Optimizer</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Upload or paste SVG markup and run it through SVGO presets to keep web assets lean. Optimization happens entirely in your browser—your vectors never leave the page.
        </p>
      </header>

  <div className="grid gap-8 items-start xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="grid gap-6 rounded-lg border bg-card p-6 shadow-sm">
          <div className="grid gap-3">
            <Label htmlFor="svg-upload" className="text-sm font-medium">
              Source SVG
            </Label>
            <input
              ref={fileInputRef}
              id="svg-upload"
              type="file"
              accept="image/svg+xml,.svg"
              onChange={handleFileSelect}
              className="sr-only"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={openFilePicker} variant="outline">
                <Upload className="mr-2 size-4" />
                {sourceSvg ? "Replace SVG" : "Upload SVG"}
              </Button>
              <Button type="button" onClick={clearAll} variant="ghost">
                Clear
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Files never leave your device; they are read with the FileReader API.
            </p>
            {uploadedFileInfo ? (
              <p className="text-xs font-medium text-foreground">Loaded {uploadedFileInfo}</p>
            ) : null}
            <Textarea
              value={sourceSvg}
              onChange={(event) => setSourceSvg(event.target.value)}
              placeholder="Paste SVG markup here..."
              spellCheck={false}
              className="min-h-64 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Paste markup or upload a file—changes re-optimize automatically.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <div className="grid gap-2">
              <Label htmlFor="preset-select" className="text-sm font-medium">
                SVGO preset
              </Label>
              <Select
                value={activePresetId}
                onValueChange={(value) => setActivePresetId(value as PresetId)}
              >
                <SelectTrigger id="preset-select">
                  <SelectValue placeholder="Choose preset" />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{descriptionByPreset}</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="file-name" className="text-sm font-medium">
                Download name
              </Label>
              <Input
                id="file-name"
                value={fileName}
                onChange={(event) => setFileName(sanitizeFileName(event.target.value))}
                placeholder="optimized"
              />
              <p className="text-xs text-muted-foreground">.svg is added automatically</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <Wand2 className="size-4" /> Preserve viewBox
              </span>
              <Switch checked={preserveViewBox} onCheckedChange={setPreserveViewBox} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <Zap className="size-4" /> Preserve IDs
              </span>
              <Switch checked={preserveIds} onCheckedChange={setPreserveIds} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <Sparkles className="size-4" /> Pretty output
              </span>
              <Switch checked={prettyOutput} onCheckedChange={setPrettyOutput} />
            </label>
          </div>

          <div className="grid gap-3">
            <Label className="text-sm font-medium">Optimized SVG</Label>
            <Textarea
              value={optimizedSvg}
              readOnly
              placeholder="Optimized SVG appears here."
              spellCheck={false}
              className="min-h-64 font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={handleCopyOptimized} disabled={!optimizedSvg} size="sm" variant="secondary">
                {copied ? "Copied" : "Copy markup"}
              </Button>
              <Button
                type="button"
                asChild
                disabled={!optimizedSvg || !optimizedUrl}
                size="sm"
              >
                <a
                  href={optimizedUrl ?? undefined}
                  download={`${fileName || "optimized"}.svg`}
                >
                  <Download className="mr-2 size-4" /> Download SVG
                </a>
              </Button>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="grid gap-6">
          <div className="grid gap-3 rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Preview</h2>
            <div className="flex w-full min-h-64 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {optimizedUrl ? (
                <img
                  src={optimizedUrl}
                  alt="Optimized SVG preview"
                  className="max-h-112 w-full object-contain"
                />
              ) : (
                <span className="text-sm text-muted-foreground">Optimized SVG preview appears here.</span>
              )}
            </div>
            <div className="grid gap-1 text-sm text-muted-foreground">
              <span>Original size: {formatBytes(originalBytes)}</span>
              <span>Optimized size: {optimizedBytes ? formatBytes(optimizedBytes) : "–"}</span>
              {savings ? (
                <span>
                  Savings: {formatBytes(savings.delta)} ({savings.percent.toFixed(1)}%)
                </span>
              ) : (
                <span>Savings: –</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Preview uses a data URL—be mindful of very large SVGs when sharing links.
            </p>
          </div>
        </div>
      </div>

      {isProcessing ? (
        <p className="text-sm text-muted-foreground">Optimizing latest changes…</p>
      ) : null}
    </section>
  );
}
