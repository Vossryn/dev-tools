declare module "culori" {
  export interface Color {
    mode: string;
    alpha?: number;
    [key: string]: unknown;
  }

  export type Converter<T = Color> = (color: Color) => (T & Color) | undefined;

  export function converter<T = Color>(mode: string): Converter<T>;
  export function parse(source: string): Color | undefined;
}
