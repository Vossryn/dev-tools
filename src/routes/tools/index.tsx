import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/")({
  component: ToolsIndex,
});

const tools = [
  {
    name: "Image Converter",
    description: "Convert images between PNG, JPEG, and WebP directly in your browser.",
    to: "/tools/image-converter",
  },
  {
    name: "Pixel Converter",
    description: "Translate measurements between px, rem, and em with a custom root size.",
    to: "/tools/pixel-converter",
  },
];

function ToolsIndex() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Tools</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Browse the growing collection of utilities. Everything runs client-side so your data stays on your device.
        </p>
      </header>

      <ul className="grid gap-4">
        {tools.map((tool) => (
          <li key={tool.to} className="rounded-lg border bg-card p-6 shadow-sm transition hover:shadow-md">
            {/* Casting avoids transient router typing issues until the route tree updates. */}
            <Link
              to={tool.to as never}
              className="flex flex-col gap-2"
            >
              <span className="text-xl font-semibold text-primary">{tool.name}</span>
              <span className="text-sm text-muted-foreground">{tool.description}</span>
              <span className="text-sm font-medium text-primary/80">Open tool →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
