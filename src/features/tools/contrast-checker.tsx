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
import { converter, parse, type Color } from "culori";
import { ArrowRightLeft, Check, X } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";

const toRgb = converter("rgb");

function getLuminance(color: Color): number {
  const rgb = toRgb(color);
  if (!rgb) return 0;

  const { r, g, b } = rgb;
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const channel = (c as number) ?? 0;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function getContrast(c1: Color, c2: Color): number {
  const l1 = getLuminance(c1);
  const l2 = getLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const DEFAULT_FOREGROUND = "#000000";
const DEFAULT_BACKGROUND = "#FFFFFF";

const ContrastChecker: React.FC = () => {
  const [foreground, setForeground] = useState(DEFAULT_FOREGROUND);
  const [background, setBackground] = useState(DEFAULT_BACKGROUND);

  const contrast = useMemo(() => {
    const fg = parse(foreground);
    const bg = parse(background);
    if (!fg || !bg) return 0;
    return getContrast(fg, bg);
  }, [foreground, background]);

  const getRating = (ratio: number, threshold: number) => {
    return ratio >= threshold ? "Pass" : "Fail";
  };

  const ratings = useMemo(() => {
    return {
      aaNormal: getRating(contrast, 4.5),
      aaLarge: getRating(contrast, 3),
      aaaNormal: getRating(contrast, 7),
      aaaLarge: getRating(contrast, 4.5),
    };
  }, [contrast]);

  const handleSwap = useCallback(() => {
    setForeground(background);
    setBackground(foreground);
  }, [foreground, background]);

  const StatusIcon = ({ status }: { status: string }) => {
    return status === "Pass" ? (
      <Check className="h-5 w-5 text-green-600" />
    ) : (
      <X className="h-5 w-5 text-red-600" />
    );
  };

  const RatingCard = ({
    title,
    status,
    description,
  }: {
    title: string;
    status: string;
    description: string;
  }) => (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="grid gap-1">
        <span className="font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-medium ${
            status === "Pass" ? "text-green-600" : "text-red-600"
          }`}
        >
          {status}
        </span>
        <StatusIcon status={status} />
      </div>
    </div>
  );

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Contrast Checker</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Calculate the contrast ratio between foreground and background colors to ensure your design meets WCAG accessibility standards.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Colors</CardTitle>
              <CardDescription>
                Choose your foreground and background colors.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr]">
                <div className="grid gap-2">
                  <Label htmlFor="foreground-color">Foreground</Label>
                  <div className="flex gap-2">
                    <Input
                      id="foreground-color"
                      type="color"
                      value={foreground}
                      onChange={(e) => setForeground(e.target.value)}
                      className="h-10 w-14 cursor-pointer p-1"
                    />
                    <Input
                      value={foreground}
                      onChange={(e) => setForeground(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-end justify-center pb-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSwap}
                    title="Swap colors"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="background-color">Background</Label>
                  <div className="flex gap-2">
                    <Input
                      id="background-color"
                      type="color"
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      className="h-10 w-14 cursor-pointer p-1"
                    />
                    <Input
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                See how your text looks on the background.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="rounded-xl border shadow-inner p-8 grid gap-4 transition-colors"
                style={{ backgroundColor: background, color: foreground }}
              >
                <p className="text-4xl font-bold">Large Text</p>
                <p className="text-base">
                  Normal text. The quick brown fox jumps over the lazy dog.
                  Accessibility is essential for an inclusive web.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                WCAG 2.1 compliance status.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="flex flex-col items-center justify-center rounded-lg bg-muted py-8">
                <span className="text-4xl font-bold">{contrast.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">Contrast Ratio</span>
              </div>

              <div className="grid gap-3">
                <RatingCard
                  title="AA Normal"
                  status={ratings.aaNormal}
                  description="Small text (below 18pt)"
                />
                <RatingCard
                  title="AA Large"
                  status={ratings.aaLarge}
                  description="Large text (above 18pt)"
                />
                <RatingCard
                  title="AAA Normal"
                  status={ratings.aaaNormal}
                  description="Small text (below 18pt)"
                />
                <RatingCard
                  title="AAA Large"
                  status={ratings.aaaLarge}
                  description="Large text (above 18pt)"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default ContrastChecker;
