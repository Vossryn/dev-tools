import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import * as React from "react";

const TanStackDevtools = import.meta.env.PROD
  ? () => null
  : React.lazy(() =>
      import("@tanstack/react-devtools").then((res) => ({
        default: res.TanStackDevtools,
      }))
    );

const TanStackRouterDevtoolsPanel = import.meta.env.PROD
  ? () => null
  : React.lazy(() =>
      import("@tanstack/react-router-devtools").then((res) => ({
        default: res.TanStackRouterDevtoolsPanel,
      }))
    );

import Header from "@/components/Header";
import { THEME_STORAGE_KEY, ThemeProvider } from "@/components/theme-provider";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Dev Tools | Browser-first utility hub",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>
          <div className="min-h-screen bg-background text-foreground bg-linear-to-b from-(--background-gradient-from) to-(--background-gradient-to)">
            <Header />
            {children}
          </div>
          <React.Suspense fallback={null}>
            <TanStackDevtools
              config={{
                position: "bottom-right",
              }}
              plugins={[
                {
                  name: "Tanstack Router",
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
          </React.Suspense>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

function ThemeScript() {
  const storageKey = JSON.stringify(THEME_STORAGE_KEY);
  const script = `!function(){try{var t=${storageKey},e=window.localStorage.getItem(t);if(e!="light"&&e!="dark"&&e!="system")e="system";var n=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light",o=e==="system"?n:e,r=window.document.documentElement;r.classList.remove("light","dark");r.classList.add(o);}catch(t){}}();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
