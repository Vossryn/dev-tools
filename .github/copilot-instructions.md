# AI Agent Instructions for Dev Tools

## Project Purpose
Browser-first, privacy-friendly developer toolkit. All tools run client-side—no uploads, no accounts. Tools include JSON/YAML/CSS parsers, image converters, color utilities, SVG optimizer, and more.

## Stack Overview
- **TanStack Start (React 19)** SSR app with file-based routing; router wired via `src/router.tsx` → `src/routeTree.gen.ts` (auto-generated—never edit manually)
- **Root layout**: `src/routes/__root.tsx` sets `<ThemeProvider>`, injects blocking `<ThemeScript>`, mounts devtools, and defines global head meta
- **Route pattern**: Thin route files (`src/routes/**`) export `Route` via `createFileRoute()` and delegate rendering to feature components in `src/features/**`

## Dev Workflow
```bash
npm install              # Install dependencies
npm run dev              # Vite + Nitro dev server on :3000 (keeps routeTree.gen.ts live)
npm run build            # Production build
npm run serve            # Preview production build
npm run test             # Run Vitest (non-watch)
```
**Critical**: Keep `npm run dev` running when adding/renaming routes—the router plugin regenerates `routeTree.gen.ts` automatically.

## Adding a New Tool (Step-by-Step)
1. **Create route file**: `src/routes/tools/my-tool.tsx` (use kebab-case slug)
   ```tsx
   import { createFileRoute } from "@tanstack/react-router";
   import MyToolComponent from "@/features/tools/my-tool";
   
   export const Route = createFileRoute("/tools/my-tool")({
     component: () => <MyToolComponent />,
   });
   ```

2. **Create feature component**: `src/features/tools/my-tool.tsx` with full tool UI/logic

3. **Register in manifest**: Add entry to `src/lib/tools.json`:
   ```json
   {
     "slug": "my-tool",
     "name": "My Tool",
     "description": "Brief description for cards",
     "tags": ["tag1", "tag2"],
     "href": "/tools/my-tool",
     "featured": false
   }
   ```
   Ensure `href` matches route path and `slug` is unique.

4. **Verify**: Check home page featured cards, `/tools` directory listing, and `Header` active link highlighting.

## Tools Manifest (`src/lib/tools.json`)
**Single source of truth** for tool metadata. Controls:
- Home page featured tool cards (filters `featured: true`)
- `/tools` directory listing with search/filter
- Link targets in navigation

**Always update** when adding, renaming, or removing tools.

## Routing & Data Flow
- **Home** (`src/routes/index.tsx` → `@/features/home`): Imports `tools.json`, filters `featured` tools, renders cards
- **Directory** (`src/routes/tools/index.tsx`): Renders full tool list from manifest with client-side filter/search
- **Tool pages** (`src/routes/tools/*.tsx`): Import and render corresponding feature component
- **Navigation**: `src/components/Header.tsx` uses TanStack `<Link>` with `activeProps`/`inactiveProps` for auto-highlighting; relies on consistent route paths

## UI & Styling Conventions
- **Tailwind CSS v4**: Custom theme in `src/styles.css` with OKLCH color space for consistent color transformations
- **Design tokens**: Modify CSS variables (`--background`, `--primary`, etc.) instead of hard-coding colors—supports light/dark themes
- **Component library**: shadcn-style primitives in `src/components/ui/*`; import via `@/components/ui/button`, merge classes with `cn()` from `src/lib/utils.ts`
- **Theme system**:
  - Storage key: `dev-tools-theme` (light/dark/system)
  - Provider: `src/components/theme-provider.tsx` handles persistence + system preference
  - **Critical**: `<ThemeScript>` in `__root.tsx` prevents flash of unstyled content—must run before body renders
  - Use `useTheme()` hook for toggles/theme-aware logic

## Client-Side Tool Patterns
All tools are **browser-only** (no server processing). Follow these patterns:

### File Processing (e.g., `ImageConverter`)
```tsx
// 1. Gate expensive work
const converted = useMemo(() => convertImage(file, settings), [file, settings]);

// 2. Revoke object URLs to prevent memory leaks
useEffect(() => {
  return () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
}, [objectUrl]);

// 3. Handle async operations (FileReader, canvas)
async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
```

### Real-Time Validation (e.g., `JsonParserTool`)
- Parse/validate on every input change (debounce if needed)
- Display inline errors with line numbers
- Format output in `<pre>` or syntax-highlighted block

### Library Integration Examples
- **Images**: `FileReader` + `canvas` + `createImageBitmap` (with Safari fallback)
- **Colors**: `culori` for conversions (OKLCH, Lab, RGB, HSL, hex)
- **SVG**: `svgo` for optimization
- **Parsing**: `marked` (Markdown), `yaml` (YAML), native `JSON.parse`, `csso` (CSS minification)

## Path Aliases & Imports
```json
// tsconfig.json
"paths": { "@/*": ["./src/*"] }
```
- Always use `@/` aliases (`@/components/ui/button`, `@/lib/utils`)—avoid relative imports (`../../`)
- Enabled by `vite-tsconfig-paths` plugin

## Responsive Patterns
- Centralized breakpoint: `useIsMobile()` hook from `src/hooks/use-mobile.ts` (768px threshold)
- Reuse for conditional rendering or logic; avoid hard-coded media queries in JS

## Generated & Protected Files
**Never edit manually**:
- `src/routeTree.gen.ts` (regenerated by `@tanstack/router-plugin` on route changes)
- Files in `public/` (static assets)

**Only edit via tooling**:
- Tailwind config embedded in `src/styles.css` `@theme` block

## Server Functions (Optional)
- Example: `src/data/demo.punk-songs.ts` (uses `createServerFn`)
- If adding server logic, remember to invalidate router on client after mutations
- Most tools avoid server—stay client-side when possible

## Key Dependencies
- **Routing**: `@tanstack/react-start`, `@tanstack/react-router`
- **UI**: Radix UI primitives + Tailwind CSS v4 + `class-variance-authority`
- **Tool libs**: `culori` (colors), `svgo` (SVG), `marked` (Markdown), `yaml`, `csso` (CSS), `dompurify` (sanitization)
- **Dev**: Vite, Vitest, TypeScript 5.7+

## Common Pitfalls
1. **Route/manifest mismatch**: Ensure `tools.json` `href` matches route path exactly
2. **Hard-coded colors**: Use CSS variables (`var(--primary)`) not hex values
3. **Relative imports**: Use `@/*` aliases consistently
4. **Object URL leaks**: Always revoke with `URL.revokeObjectURL()` in cleanup
5. **Theme flash**: Keep `<ThemeScript>` in `__root.tsx` before body content
6. **Manual route edits**: Let router plugin regenerate `routeTree.gen.ts`—don't touch it
