import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import tools from "@/lib/tools.json";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

function Tools() {
  const [query, setQuery] = useState("");

  const filteredTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return tools;
    }

    return tools.filter((tool) =>
      tool.name.toLowerCase().includes(normalizedQuery) ||
      tool.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    );
  }, [query]);

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Tools</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Browse the growing collection of utilities. Everything runs client-side so your data stays on your device.
        </p>
      </header>
      <div className="flex flex-col gap-2">
        <label htmlFor="tools-filter" className="text-sm font-medium text-muted-foreground">
          Filter by name or tag
        </label>
        <Input
          id="tools-filter"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tools..."
          autoComplete="off"
          className="bg-card shadow-sm"
        />
      </div>
      {filteredTools.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tools match that search. Try a different keyword.</p>
      ) : (
        <ul className="grid gap-4">
          {filteredTools.map((tool) => (
          <li key={tool.slug} className="rounded-lg border bg-card p-6 shadow-sm transition hover:scale-[1.01] hover:shadow-md">
            <Link to={tool.href} className="flex flex-col gap-2">
              <span className="text-xl font-semibold text-primary">{tool.name}</span>
              <span className="text-sm text-muted-foreground">{tool.description}</span>
              <div className="flex flex-wrap gap-2">
                {tool.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
              <span className="text-sm font-medium text-primary/80">Open tool →</span>
            </Link>
          </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default Tools;
