import React, { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LengthUnit = "px" | "rem" | "em";

type ConversionResult =
  | { error: string }
  | { px: number; rem: number; em: number; base: number };

type DisplayState =
  | { state: "error"; message: string }
  | { state: "ready"; values: { px: string; rem: string; em: string }; base: string };

const UNIT_OPTIONS: Array<{ value: LengthUnit; label: string }> = [
  { value: "px", label: "Pixels (px)" },
  { value: "rem", label: "Root em (rem)" },
  { value: "em", label: "Relative em (em)" },
];

const PRECISION = 4;

function formatNumber(value: number) {
  return value.toFixed(PRECISION).replace(/\.?0+$/, "");
}

const PixelConverter: React.FC = () => {
  const [valueInput, setValueInput] = useState("16");
  const [unit, setUnit] = useState<LengthUnit>("px");
  const [baseSizeInput, setBaseSizeInput] = useState("16");

  const conversion = useMemo<ConversionResult>(() => {
    const parsedValue = Number.parseFloat(valueInput);
    const parsedBase = Number.parseFloat(baseSizeInput);

    if (!Number.isFinite(parsedValue)) {
      return { error: "Enter a numeric measurement to convert." };
    }

    if (!Number.isFinite(parsedBase) || parsedBase <= 0) {
      return { error: "Root font size must be a positive number." };
    }

    let pxValue = parsedValue;

    if (unit === "rem" || unit === "em") {
      pxValue = parsedValue * parsedBase;
    }

    const remValue = pxValue / parsedBase;
    const emValue = remValue;

    return {
      px: pxValue,
      rem: remValue,
      em: emValue,
      base: parsedBase,
    };
  }, [baseSizeInput, unit, valueInput]);

  const display = useMemo<DisplayState>(() => {
    if ("error" in conversion) {
      return { state: "error", message: conversion.error };
    }

    return {
      state: "ready",
      values: {
        px: formatNumber(conversion.px),
        rem: formatNumber(conversion.rem),
        em: formatNumber(conversion.em),
      },
      base: formatNumber(conversion.base),
    };
  }, [conversion]);

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Pixel Converter</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Convert between px, rem, and em using the browser&apos;s base font size. Update any field to see the other units adjust instantly.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Measurement</CardTitle>
          <CardDescription>
            Choose a value and unit, then set the root font size (typically 16px) to update the conversions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="measurement-value">Value</Label>
              <Input
                id="measurement-value"
                inputMode="decimal"
                value={valueInput}
                onChange={(event) => setValueInput(event.target.value)}
                placeholder="0"
                aria-describedby="measurement-help"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="measurement-unit">Unit</Label>
              <Select
                value={unit}
                onValueChange={(nextUnit) => setUnit(nextUnit as LengthUnit)}
              >
                <SelectTrigger id="measurement-unit">
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="root-size">Root font size (px)</Label>
            <Input
              id="root-size"
              inputMode="decimal"
              value={baseSizeInput}
              onChange={(event) => setBaseSizeInput(event.target.value)}
              placeholder="16"
            />
            <p id="measurement-help" className="text-xs text-muted-foreground">
              Most browsers default to 16px. Adjust this if the site uses a different root size.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Converted Values</CardTitle>
          <CardDescription>
            Results update automatically as you type.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {display.state === "error" ? (
            <p className="text-sm text-destructive" role="alert">
              {display.message}
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pixels (px)
                  </p>
                  <p className="text-2xl font-semibold">
                    {display.values.px}
                    <span className="text-sm font-medium text-muted-foreground"> px</span>
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Root em (rem)
                  </p>
                  <p className="text-2xl font-semibold">
                    {display.values.rem}
                    <span className="text-sm font-medium text-muted-foreground"> rem</span>
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Relative em (em)
                  </p>
                  <p className="text-2xl font-semibold">
                    {display.values.em}
                    <span className="text-sm font-medium text-muted-foreground"> em</span>
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                With a root font size of {display.base}px: 1rem = {display.base}px and 1em = {display.base}px for this calculation.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export default PixelConverter;
