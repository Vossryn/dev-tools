import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { Color } from "culori";
import { converter, parse } from "culori";

const toOklch = converter("oklch");
const toRgb = converter("rgb");
const toHsl = converter("hsl");
const toHwb = converter("hwb");
const toLab = converter("lab");
const toLch = converter("lch");
const toOklab = converter("oklab");

const DEFAULT_SWATCH = "#6366f1";

const FALLBACK_COLOR: Color = {
  mode: "oklch",
  l: 0.65,
  c: 0.16,
  h: 264,
  alpha: 1,
};

const COLOR_FORMATS = [
  { id: "hex", label: "Hex", hint: "Six-digit hex value." },
  { id: "rgb", label: "RGB", hint: "rgb(r, g, b)" },
  { id: "rgba", label: "RGBA", hint: "rgba(r, g, b, a)" },
  { id: "hsl", label: "HSL", hint: "hsl(h, s, l)" },
  { id: "hsla", label: "HSLA", hint: "hsla(h, s, l, a)" },
  { id: "hwb", label: "HWB", hint: "hwb(h w b / a)" },
  { id: "lab", label: "Lab", hint: "lab(l a b / a)" },
  { id: "lch", label: "LCH", hint: "lch(l c h / a)" },
  { id: "oklab", label: "OKLab", hint: "oklab(l a b / a)" },
  { id: "oklch", label: "OKLCH", hint: "oklch(l c h / a)" },
] as const;

type FormatId = (typeof COLOR_FORMATS)[number]["id"];

type InputErrors = Partial<Record<FormatId, string>>;

type FormatValues = Record<FormatId, string>;

function clamp(value: number, min = 0, max = 1) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function normalizeHue(hue: number | undefined) {
  if (typeof hue !== "number" || !Number.isFinite(hue)) {
    return 0;
  }
  const normalized = hue % 360;
  return normalized >= 0 ? normalized : normalized + 360;
}

function trimTrailingZeros(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$|\.0+$/u, "$1");
}

function formatDecimal(value: number, decimals = 3) {
  return trimTrailingZeros(value.toFixed(decimals));
}

function formatPercent(value: number) {
  return `${trimTrailingZeros((clamp(value) * 100).toFixed(2))}%`;
}

function formatAlpha(value: number) {
  return formatDecimal(clamp(value), 3);
}

function parseToCanonical(input: string): Color | null {
  const parsed = parse(input.trim());
  if (!parsed) {
    return null;
  }
  const oklch = toOklch(parsed);
  if (!oklch) {
    return null;
  }
  const alpha = "alpha" in oklch ? clamp(oklch.alpha ?? 1) : 1;
  return { ...oklch, alpha };
}

function colorToHex(color: Color) {
  const rgb = toRgb(color);
  if (!rgb) {
    return "#000000";
  }
  const toChannel = (value: number) => {
    const channel = Math.round(clamp(value) * 255);
    return channel.toString(16).padStart(2, "0").toUpperCase();
  };
  return `#${toChannel(rgb.r as number)}${toChannel(rgb.g as number)}${toChannel(rgb.b as number)}`;
}

function colorToRgba(color: Color) {
  const rgb = toRgb(color);
  if (!rgb) {
    return "rgba(0, 0, 0, 1)";
  }
  const r = Math.round(clamp(rgb.r as number) * 255);
  const g = Math.round(clamp(rgb.g as number) * 255);
  const b = Math.round(clamp(rgb.b as number) * 255);
  const alpha = formatAlpha("alpha" in rgb ? rgb.alpha ?? 1 : 1);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatValues(color: Color): FormatValues {
  const alpha = "alpha" in color ? color.alpha ?? 1 : 1;
  const rgb = toRgb(color);
  const hsl = toHsl(color);
  const hwb = toHwb(color);
  const lab = toLab(color);
  const lch = toLch(color);
  const oklab = toOklab(color);
  const oklch = toOklch(color) ?? color;

  const safeRgb = rgb ?? { r: 0, g: 0, b: 0, alpha: 1 };
  const safeHsl = hsl ?? { h: 0, s: 0, l: 0, alpha: alpha };
  const safeHwb = hwb ?? { h: 0, w: 0, b: 0, alpha: alpha };
  const safeLab = lab ?? { l: 0, a: 0, b: 0, alpha: alpha };
  const safeLch = lch ?? { l: 0, c: 0, h: 0, alpha: alpha };
  const safeOklab = oklab ?? { l: 0, a: 0, b: 0, alpha: alpha };
  const safeOklch = oklch ?? { l: 0, c: 0, h: 0, alpha: alpha };

  const rgbString = (() => {
    const r = Math.round(clamp(safeRgb.r as number) * 255);
    const g = Math.round(clamp(safeRgb.g as number) * 255);
    const b = Math.round(clamp(safeRgb.b as number) * 255);
    return `rgb(${r}, ${g}, ${b})`;
  })();

  const rgbaString = (() => {
    const r = Math.round(clamp(safeRgb.r as number) * 255);
    const g = Math.round(clamp(safeRgb.g as number) * 255);
    const b = Math.round(clamp(safeRgb.b as number) * 255);
    return `rgba(${r}, ${g}, ${b}, ${formatAlpha(safeRgb.alpha ?? alpha)})`;
  })();

  const hslString = (() => {
    const h = normalizeHue(safeHsl.h as number | undefined);
    const s = formatPercent(safeHsl.s as number);
    const l = formatPercent(safeHsl.l as number);
    return `hsl(${formatDecimal(h, 1)}, ${s}, ${l})`;
  })();

  const hslaString = (() => {
    const h = normalizeHue(safeHsl.h as number | undefined);
    const s = formatPercent(safeHsl.s as number);
    const l = formatPercent(safeHsl.l as number);
    return `hsla(${formatDecimal(h, 1)}, ${s}, ${l}, ${formatAlpha(safeHsl.alpha ?? alpha)})`;
  })();

  const hwbString = (() => {
    const h = normalizeHue(safeHwb.h as number | undefined);
    const w = formatPercent(safeHwb.w as number);
    const b = formatPercent(safeHwb.b as number);
    return `hwb(${formatDecimal(h, 1)} ${w} ${b} / ${formatAlpha(safeHwb.alpha ?? alpha)})`;
  })();

  const labString = (() => {
    const l = formatDecimal(safeLab.l as number ?? 0, 2);
    const a = formatDecimal(safeLab.a as number ?? 0, 3);
    const b = formatDecimal(safeLab.b as number ?? 0, 3);
    return `lab(${l} ${a} ${b} / ${formatAlpha(safeLab.alpha ?? alpha)})`;
  })();

  const lchString = (() => {
    const l = formatDecimal(safeLch.l as number ?? 0, 2);
    const c = formatDecimal(safeLch.c as number ?? 0, 3);
    const h = formatDecimal(normalizeHue(safeLch.h as number), 1);
    return `lch(${l} ${c} ${h} / ${formatAlpha(safeLch.alpha ?? alpha)})`;
  })();

  const oklabString = (() => {
    const l = formatDecimal(safeOklab.l as number ?? 0, 3);
    const a = formatDecimal(safeOklab.a as number ?? 0, 4);
    const b = formatDecimal(safeOklab.b as number ?? 0, 4);
    return `oklab(${l} ${a} ${b} / ${formatAlpha(safeOklab.alpha ?? alpha)})`;
  })();

  const oklchString = (() => {
    const l = formatDecimal(safeOklch.l as number ?? 0, 3);
    const c = formatDecimal(safeOklch.c as number ?? 0, 4);
    const h = formatDecimal(normalizeHue(safeOklch.h as number), 1);
    return `oklch(${l} ${c} ${h} / ${formatAlpha(safeOklch.alpha ?? alpha)})`;
  })();

  return {
    hex: colorToHex(color),
    rgb: rgbString,
    rgba: rgbaString,
    hsl: hslString,
    hsla: hslaString,
    hwb: hwbString,
    lab: labString,
    lch: lchString,
    oklab: oklabString,
    oklch: oklchString,
  };
}

const INITIAL_COLOR = parseToCanonical(DEFAULT_SWATCH) ?? FALLBACK_COLOR;
const INITIAL_VALUES = formatValues(INITIAL_COLOR);

const ColorConverter: React.FC = () => {
  const [color, setColor] = useState<Color>(INITIAL_COLOR);
  const [inputValues, setInputValues] = useState<FormatValues>(INITIAL_VALUES);
  const [inputErrors, setInputErrors] = useState<InputErrors>({});

  useEffect(() => {
    const nextValues = formatValues(color);
    setInputValues(nextValues);
    setInputErrors({});
  }, [color]);

  const previewColor = useMemo(() => colorToRgba(color), [color]);
  const pickerColor = useMemo(() => colorToHex(color), [color]);
  const alphaValue = useMemo(() => {
    return "alpha" in color ? clamp(color.alpha ?? 1) : 1;
  }, [color]);

  const handlePickerChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseToCanonical(event.target.value);
    if (next) {
      setColor(next);
    }
  }, []);

  const handleAlphaSliderChange = useCallback((values: number[]) => {
    const next = values[0];
    if (typeof next !== "number" || Number.isNaN(next)) {
      return;
    }
    setColor((previous: Color) => {
      const base = toOklch(previous) ?? FALLBACK_COLOR;
      return { ...base, alpha: clamp(next) } as Color;
    });
  }, []);

  const applyInput = useCallback((format: FormatId, raw: string) => {
    const parsed = parseToCanonical(raw);
    setInputErrors((previous) => {
      const next = { ...previous };
      if (parsed) {
        delete next[format];
      } else {
        next[format] = "Unrecognized color value.";
      }
      return next;
    });
    if (parsed) {
      setColor(parsed);
    }
  }, []);

  const handleInputChange = useCallback((format: FormatId, value: string) => {
    setInputValues((previous) => ({ ...previous, [format]: value }));
    setInputErrors((previous) => {
      if (!previous[format]) {
        return previous;
      }
      const next = { ...previous };
      delete next[format];
      return next;
    });
  }, []);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">CSS Color Converter</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Pick a color or paste any CSS color string to see synchronized values across RGB, HSL, HWB, Lab, OKLab, and more modern color spaces.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Base Color</CardTitle>
          <CardDescription>
            Adjust the swatch, set opacity, or paste any CSS color. Results update instantly for every supported format.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <div
              className="rounded-xl border shadow-inner"
              style={{ background: previewColor, minHeight: "160px" }}
            />
            <div className="grid gap-1 text-xs text-muted-foreground">
              <span>Preview swatch reflects the current color including alpha.</span>
              <span>Background updates using the RGBA representation.</span>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="color-picker">Color picker</Label>
              <Input
                id="color-picker"
                type="color"
                value={pickerColor}
                onChange={handlePickerChange}
                className="h-12 w-32 cursor-pointer p-1"
                aria-label="Select color"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opacity-slider">Opacity</Label>
              <Slider
                id="opacity-slider"
                min={0}
                max={1}
                step={0.01}
                value={[alphaValue]}
                onValueChange={handleAlphaSliderChange}
                aria-label="Opacity"
              />
              <span className="text-xs text-muted-foreground">
                {Math.round(alphaValue * 100)}% alpha
              </span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="color-hex">Hex value</Label>
              <Input
                id="color-hex"
                value={inputValues.hex}
                onChange={(event) => handleInputChange("hex", event.target.value)}
                onBlur={(event) => applyInput("hex", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    applyInput("hex", event.currentTarget.value);
                  }
                }}
                spellCheck={false}
              />
              {inputErrors.hex ? (
                <p className="text-xs text-destructive" role="alert">
                  {inputErrors.hex}
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color Values</CardTitle>
          <CardDescription>
            Each input accepts any equivalent CSS color string. Press Enter or blur the field to apply updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {COLOR_FORMATS.filter((format) => format.id !== "hex").map((format) => (
              <div key={format.id} className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`color-${format.id}`}>{format.label}</Label>
                  <span className="text-xs text-muted-foreground">{format.hint}</span>
                </div>
                <Input
                  id={`color-${format.id}`}
                  value={inputValues[format.id]}
                  onChange={(event) => handleInputChange(format.id, event.target.value)}
                  onBlur={(event) => applyInput(format.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      applyInput(format.id, event.currentTarget.value);
                    }
                  }}
                  spellCheck={false}
                />
                {inputErrors[format.id] ? (
                  <p className="text-xs text-destructive" role="alert">
                    {inputErrors[format.id]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default ColorConverter;
