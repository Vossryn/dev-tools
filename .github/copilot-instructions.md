**Project Snapshot**
- React 19 + TanStack Start SSR app; router instance built in `src/router.tsx` from generated `src/routeTree.gen.ts` (never edit, plugin regenerates when you add/remove files in `src/routes`).
- Root HTML shell lives in `src/routes/__root.tsx` using `shellComponent`; wrap global UI (e.g., `<Header />`, devtools) there and leave route components focused on page content.
- Feature pages live under `src/routes/**` and usually wrap a reusable view from `src/features/*` (see `src/routes/index.tsx` delegating to `src/features/home.tsx`).
- Sample demos under `src/routes/demo/*` showcase server functions, SPA fetching, and SSR modes; safe to remove, but keep them for reference when building similar flows.

**Run & Debug**
- Install once with `npm install`; use `npm run dev` for Vite+Nitro dev server on port 3000 so TanStack Start server functions execute correctly.
- Production path is `npm run build` followed by `npm run serve`; CI-style unit tests run via `npm run test` (Vitest + jsdom).
- Hot reload rebuilds the route tree automatically; if the app complains about missing route modules, ensure the dev server is running to regenerate `routeTree.gen.ts`.

**Routing Patterns**
- Define routes with `createFileRoute`; export a named `Route` constant and return your component/loader definition (see `src/routes/demo/start.api-request.tsx`).
- For server-rendered data, add a `loader` to the route definition or call TanStack Query inside the component depending on hydration needs.
- API-like endpoints live alongside pages by providing `server.handlers` inside the route module (see `src/routes/demo/api.names.ts` returning JSON).
- Always import reusable views via the `@` path alias configured in `tsconfig.json` (e.g., `import Home from "@/features/home"`).

**Server Functions & Data**
- Use `createServerFn` from `@tanstack/react-start` for server-side actions; the pattern in `src/routes/demo/start.server-funcs.tsx` shows validating input, reading Node resources, and invalidating the router.
- Shared server utilities can live under `src/data`; `src/data/demo.punk-songs.ts` exports a server fn that any route can import.
- When mutating data, remember to call `router.invalidate()` in the client so loaders refetch updated server state.

**UI & Styling**
- Tailwind CSS v4 is configured in `src/styles.css` with custom theming tokens; prefer utility classes and the existing CSS variables rather than writing ad-hoc styles.
- UI primitives are shadcn/radix wrappers in `src/components/ui/*`; they rely on the `cn` helper from `src/lib/utils.ts` to merge classes and provide `data-slot` hooks for styling.
- Global header lives in `src/components/Header.tsx` and uses TanStack `Link`; add site-wide navigation there to keep route files minimal.
- The responsive helper `useIsMobile` in `src/hooks/use-mobile.ts` centralizes the 768px breakpoint; reuse it instead of duplicating matchMedia checks.
- Component imports follow the aliases defined in `components.json`; prefer `@/components/ui/button` style paths to keep future codegen compatible.
