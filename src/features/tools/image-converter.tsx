import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { Lock, Unlock } from "lucide-react";

const SUPPORTED_FORMATS = [
  { value: "image/png", label: "PNG" },
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/webp", label: "WebP" },
];

const LOSSY_FORMATS = new Set(["image/jpeg", "image/webp"]);

const DEFAULT_QUALITY = 0.92;

interface ConvertedImage {
  blob: Blob;
  url: string;
  fileName: string;
  sizeReadable: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  return `${size.toFixed(size > 10 ? 0 : 1)} ${sizes[i]}`;
}

function sanitizeFileName(name: string) {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, " ");
  const condensed = cleaned.replace(/\s+/g, " ").trim();
  return condensed || "converted";
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unsupported file result."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

async function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load the image."));
    image.src = dataUrl;
  });
}

async function extractImageDimensions(file: File) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      if ("close" in bitmap) {
        (bitmap as ImageBitmap & { close?: () => void }).close?.();
      }
      return dimensions;
    } catch {
      // Fall through to the data URL path when createImageBitmap fails (e.g., Safari).
    }
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(dataUrl);
  return { width: image.width, height: image.height };
}

type ImageSource = {
  width: number;
  height: number;
  draw: (
    ctx: CanvasRenderingContext2D,
    targetWidth: number,
    targetHeight: number
  ) => void;
};

async function loadImageSource(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, targetWidth, targetHeight) => {
          ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
          if ("close" in bitmap) {
            (bitmap as ImageBitmap & { close?: () => void }).close?.();
          }
        },
      };
    } catch {
      // Fall through to using an HTMLImageElement when createImageBitmap fails.
    }
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(dataUrl);
  return {
    width: image.width,
    height: image.height,
    draw: (ctx, targetWidth, targetHeight) => {
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    },
  };
}

function gcd(a: number, b: number) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function describeAspectRatio(width: number, height: number) {
  if (!width || !height) {
    return null;
  }
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

export default function ImageConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [targetFormat, setTargetFormat] = useState<string>(
    SUPPORTED_FORMATS[0].value
  );
  const [quality, setQuality] = useState<number>(DEFAULT_QUALITY);
  const [isProcessing, setIsProcessing] = useState(false);
  const [convertedImage, setConvertedImage] = useState<ConvertedImage | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [outputName, setOutputName] = useState<string>("");
  const [originalDimensions, setOriginalDimensions] = useState<
    { width: number; height: number } | null
  >(null);
  const [targetWidth, setTargetWidth] = useState<number | "">("");
  const [targetHeight, setTargetHeight] = useState<number | "">("");
  const [isAspectLocked, setIsAspectLocked] = useState(true);
  const fileTokenRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const convertTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
      if (convertedImage?.url) {
        URL.revokeObjectURL(convertedImage.url);
      }
    };
  }, [sourceUrl, convertedImage?.url]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];

    event.target.value = "";

    if (!nextFile) {
      setFile(null);
      setOriginalDimensions(null);
      setTargetWidth("");
      setTargetHeight("");
      setIsAspectLocked(true);
      setSourceUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setConvertedImage((prev) => {
        if (prev?.url) {
          URL.revokeObjectURL(prev.url);
        }
        return null;
      });
      return;
    }

    if (!nextFile.type.startsWith("image/")) {
      setError("Please select an image file.");
      setFile(null);
      setOriginalDimensions(null);
      setTargetWidth("");
      setTargetHeight("");
      setIsAspectLocked(true);
      setSourceUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setConvertedImage((prev) => {
        if (prev?.url) {
          URL.revokeObjectURL(prev.url);
        }
        return null;
      });
      return;
    }

    fileTokenRef.current += 1;
    const currentToken = fileTokenRef.current;

    setError(null);
    setFile(nextFile);
    setOutputName(nextFile.name.replace(/\.[^.]+$/, ""));
    setIsAspectLocked(true);
    setTargetWidth("");
    setTargetHeight("");
    setConvertedImage((prev) => {
      if (prev?.url) {
        URL.revokeObjectURL(prev.url);
      }
      return null;
    });

    setSourceUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(nextFile);
    });

    void (async () => {
      try {
        const dimensions = await extractImageDimensions(nextFile);
        if (fileTokenRef.current !== currentToken) {
          return;
        }
        setOriginalDimensions(dimensions);
        setTargetWidth(dimensions.width);
        setTargetHeight(dimensions.height);
      } catch (dimensionError) {
        if (fileTokenRef.current !== currentToken) {
          return;
        }
        console.error(dimensionError);
        setError(
          dimensionError instanceof Error
            ? `Could not read image dimensions: ${dimensionError.message}`
            : "Could not read image dimensions."
        );
        setOriginalDimensions(null);
        setTargetWidth("");
        setTargetHeight("");
      }
    })();
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const canAdjustQuality = useMemo(
    () => LOSSY_FORMATS.has(targetFormat),
    [targetFormat]
  );

  const aspectRatio = useMemo(() => {
    if (!originalDimensions || originalDimensions.height === 0) {
      return null;
    }
    return originalDimensions.width / originalDimensions.height;
  }, [originalDimensions]);

  const aspectRatioLabel = useMemo(() => {
    if (!originalDimensions) {
      return null;
    }
    return describeAspectRatio(
      Math.round(originalDimensions.width),
      Math.round(originalDimensions.height)
    );
  }, [originalDimensions]);

  const targetFileName = useMemo(() => {
    const preferredBase = outputName || file?.name.replace(/\.[^.]+$/, "");
    const baseName = sanitizeFileName(preferredBase ?? "converted");
    const extension = targetFormat === "image/jpeg" ? "jpg" : targetFormat.split("/")[1];
    return `${baseName}.${extension}`;
  }, [file, outputName, targetFormat]);

  useEffect(() => {
    setConvertedImage((prev) => {
      if (!prev || prev.fileName === targetFileName) {
        return prev;
      }
      return { ...prev, fileName: targetFileName };
    });
  }, [targetFileName]);

  // Debounce conversions so updates feel responsive without thrashing the canvas work.
  useEffect(() => {
    if (!file) {
      setConvertedImage(null);
      setIsProcessing(false);
      setError(null);
      return;
    }

    const currentToken = convertTokenRef.current + 1;
    convertTokenRef.current = currentToken;

    const runConversion = async () => {
      if (convertTokenRef.current !== currentToken) {
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Unable to access canvas context.");
        }

        const source = await loadImageSource(file);

        const baseWidth = originalDimensions?.width ?? source.width;
        const baseHeight = originalDimensions?.height ?? source.height;

        const widthCandidate =
          typeof targetWidth === "number" && targetWidth > 0
            ? targetWidth
            : baseWidth;
        const heightCandidate =
          typeof targetHeight === "number" && targetHeight > 0
            ? targetHeight
            : baseHeight;

        const safeWidth = Math.max(1, Math.round(widthCandidate));
        const safeHeight = Math.max(1, Math.round(heightCandidate));

        if (!originalDimensions) {
          setOriginalDimensions({
            width: source.width,
            height: source.height,
          });
        }

        canvas.width = safeWidth;
        canvas.height = safeHeight;

        source.draw(ctx, safeWidth, safeHeight);

        const blob: Blob | null = await new Promise((resolve) => {
          canvas.toBlob(
            (result) => resolve(result),
            targetFormat,
            canAdjustQuality ? quality : undefined
          );
        });

        if (!blob) {
          throw new Error("Could not convert the image.");
        }

        if (convertTokenRef.current !== currentToken) {
          return;
        }

        const url = URL.createObjectURL(blob);

        if (convertTokenRef.current !== currentToken) {
          URL.revokeObjectURL(url);
          return;
        }

        setConvertedImage((prev) => {
          if (prev?.url) {
            URL.revokeObjectURL(prev.url);
          }
          return {
            blob,
            url,
            fileName: targetFileName,
            sizeReadable: formatBytes(blob.size),
          };
        });
      } catch (conversionError) {
        if (convertTokenRef.current !== currentToken) {
          return;
        }
        console.error(conversionError);
        setError(
          conversionError instanceof Error
            ? conversionError.message
            : "Something went wrong during conversion."
        );
      } finally {
        if (convertTokenRef.current === currentToken) {
          setIsProcessing(false);
        }
      }
    };

    const timeoutId = window.setTimeout(() => {
      void runConversion();
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    canAdjustQuality,
    file,
    originalDimensions,
    quality,
    targetFileName,
    targetFormat,
    targetHeight,
    targetWidth,
  ]);

  const exportWidth = useMemo(() => {
    if (typeof targetWidth === "number" && targetWidth > 0) {
      return targetWidth;
    }
    return originalDimensions?.width ?? null;
  }, [targetWidth, originalDimensions]);

  const exportHeight = useMemo(() => {
    if (typeof targetHeight === "number" && targetHeight > 0) {
      return targetHeight;
    }
    return originalDimensions?.height ?? null;
  }, [targetHeight, originalDimensions]);

  const exportAspectRatioLabel = useMemo(() => {
    if (!exportWidth || !exportHeight) {
      return null;
    }
    return describeAspectRatio(
      Math.round(exportWidth),
      Math.round(exportHeight)
    );
  }, [exportHeight, exportWidth]);

  const handleWidthInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (value === "") {
        setTargetWidth("");
        return;
      }

      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return;
      }

      const rounded = Math.round(parsed);
      setTargetWidth(rounded);

      if (isAspectLocked && aspectRatio) {
        const computedHeight = Math.max(1, Math.round(rounded / aspectRatio));
        setTargetHeight(computedHeight);
      }
    },
    [aspectRatio, isAspectLocked]
  );

  const handleHeightInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (value === "") {
        setTargetHeight("");
        return;
      }

      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return;
      }

      const rounded = Math.round(parsed);
      setTargetHeight(rounded);

      if (isAspectLocked && aspectRatio) {
        const computedWidth = Math.max(1, Math.round(rounded * aspectRatio));
        setTargetWidth(computedWidth);
      }
    },
    [aspectRatio, isAspectLocked]
  );

  const handleAspectToggle = useCallback(
    (nextState: boolean) => {
      setIsAspectLocked(nextState);
      if (nextState && aspectRatio) {
        if (typeof targetWidth === "number" && targetWidth > 0) {
          const computedHeight = Math.max(
            1,
            Math.round(targetWidth / aspectRatio)
          );
          setTargetHeight(computedHeight);
        } else if (typeof targetHeight === "number" && targetHeight > 0) {
          const computedWidth = Math.max(
            1,
            Math.round(targetHeight * aspectRatio)
          );
          setTargetWidth(computedWidth);
        } else if (originalDimensions) {
          setTargetWidth(originalDimensions.width);
          setTargetHeight(originalDimensions.height);
        }
      }
    },
    [aspectRatio, originalDimensions, targetHeight, targetWidth]
  );

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Image Converter</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Convert images to PNG, JPEG, or WebP directly in your browser. Files
          never leave your device, and converted results are generated locally
          using canvas APIs.
        </p>
      </header>

      <div className="grid gap-6 rounded-lg border bg-card p-6 shadow-sm">
        <div className="grid gap-3">
          <label className="text-sm font-medium" htmlFor="image-input">
            Select an image
          </label>
          <input
            ref={fileInputRef}
            id="image-input"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="sr-only"
          />
          <Button type="button" onClick={openFilePicker} className="w-fit">
            {file ? "Change image" : "Choose image"}
          </Button>
          {file ? (
            <p className="text-xs text-muted-foreground">
              Loaded {file.name} · {formatBytes(file.size)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Choose PNG, JPEG, WebP, or other common image formats.
            </p>
          )}
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="output-name">
              Output name
            </label>
            <Input
              id="output-name"
              placeholder="Converted file name"
              value={outputName}
              onChange={(event) => setOutputName(event.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Extension is added automatically: {targetFileName}
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <span className="text-sm font-medium">Output format</span>
            <Select value={targetFormat} onValueChange={setTargetFormat}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose format" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_FORMATS.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="quality-range">
              Quality
            </label>
            <Slider
              id="quality-range"
              min={0.3}
              max={1}
              step={0.01}
              value={[quality]}
              disabled={!canAdjustQuality}
              onValueChange={(values) => {
                const nextValue = values[0];
                if (typeof nextValue === "number" && !Number.isNaN(nextValue)) {
                  setQuality(nextValue);
                }
              }}
              aria-label="Quality"
            />
            <span className="text-xs text-muted-foreground">
              {canAdjustQuality
                ? `Quality: ${(quality * 100).toFixed(0)}%`
                : "Lossless format selected; quality is fixed."}
            </span>
          </div>

          <div className="grid gap-3 md:col-span-2">
            <span className="text-sm font-medium">Dimensions</span>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
              <div className="grid gap-1.5">
                <label
                  className="text-xs font-semibold uppercase tracking-wide"
                  htmlFor="output-width"
                >
                  Width (px)
                </label>
                <Input
                  id="output-width"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={targetWidth === "" ? "" : targetWidth}
                  onChange={handleWidthInput}
                  placeholder={
                    originalDimensions ? String(originalDimensions.width) : ""
                  }
                  disabled={!originalDimensions}
                />
              </div>
              <Toggle
                className="gap-1"
                pressed={isAspectLocked}
                onPressedChange={handleAspectToggle}
                variant="outline"
                disabled={!originalDimensions}
                aria-label={
                  isAspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"
                }
              >
                {isAspectLocked ? (
                  <Lock className="size-3.5" />
                ) : (
                  <Unlock className="size-3.5" />
                )}
                <span className="text-xs font-medium">
                  {isAspectLocked
                    ? "Aspect Ratio Locked"
                    : "Aspect Ratio Unlocked"}
                </span>
              </Toggle>
              <div className="grid gap-1.5">
                <label
                  className="text-xs font-semibold uppercase tracking-wide"
                  htmlFor="output-height"
                >
                  Height (px)
                </label>
                <Input
                  id="output-height"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={targetHeight === "" ? "" : targetHeight}
                  onChange={handleHeightInput}
                  placeholder={
                    originalDimensions ? String(originalDimensions.height) : ""
                  }
                  disabled={!originalDimensions}
                />
              </div>
            </div>

            <div className="grid gap-1 text-xs text-muted-foreground md:grid-cols-2 md:gap-2">
              <span>
                {originalDimensions
                  ? `Original: ${Math.round(originalDimensions.width)} × ${Math.round(originalDimensions.height)} px${
                      aspectRatioLabel ? ` · ${aspectRatioLabel}` : ""
                    }`
                  : "Select an image to view its original dimensions."}
              </span>
              <span>
                {exportWidth && exportHeight
                  ? `Export: ${Math.round(exportWidth)} × ${Math.round(exportHeight)} px${
                      exportAspectRatioLabel ? ` · ${exportAspectRatioLabel}` : ""
                    }`
                  : "Export dimensions will match the original image."}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              {isAspectLocked
                ? "Lock enabled: updating width automatically adjusts height to preserve the original proportions."
                : "Lock disabled: width and height can be edited independently."}
            </p>
          </div>
        </div>

        <div className="flex flex-col flex-wrap items-center gap-3">
          {file ? (
            <p className="text-sm text-muted-foreground">
              {isProcessing
                ? "Processing latest changes…"
                : "Preview updates automatically as you adjust settings."}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select an image to begin converting.
            </p>
          )}
          {convertedImage ? (
            <Button asChild variant="default" disabled={isProcessing}>
              <a href={convertedImage.url} download={convertedImage.fileName}>
                Download {convertedImage.fileName} ({convertedImage.sizeReadable})
              </a>
            </Button>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <figure className="grid gap-3">
          <figcaption className="text-sm font-medium">
            Original preview
          </figcaption>
          {sourceUrl ? (
            <img
              src={sourceUrl}
              alt="Original upload preview"
              className="aspect-video w-full rounded-md border object-contain"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              No image selected
            </div>
          )}
        </figure>

        <figure className="grid gap-3">
          <figcaption className="text-sm font-medium">
            Converted preview
          </figcaption>
          {convertedImage ? (
            <img
              src={convertedImage.url}
              alt="Converted file preview"
              className="aspect-video w-full rounded-md border object-contain"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              Conversion output appears here
            </div>
          )}
        </figure>
      </div>
    </section>
  );
}
