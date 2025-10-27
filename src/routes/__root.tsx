import { TanStackDevtools } from '@tanstack/react-devtools'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import Header from '@/components/Header'
import { THEME_STORAGE_KEY, ThemeProvider } from '@/components/theme-provider'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Dev Tools | Browser-first utility hub',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>
          <Header />
          <div className="min-h-screen bg-background text-foreground bg-linear-to-b from-(--background-gradient-from) to-(--background-gradient-to)">
            {children}
          </div>
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}

function ThemeScript() {
  const storageKey = JSON.stringify(THEME_STORAGE_KEY)
  const script = `!function(){try{var t=${storageKey},e=window.localStorage.getItem(t);if(e!="light"&&e!="dark"&&e!="system")e="system";var n=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light",o=e==="system"?n:e,r=window.document.documentElement;r.classList.remove("light","dark");r.classList.add(o);}catch(t){}}();`

  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
