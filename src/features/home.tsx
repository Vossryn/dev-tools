import React from "react";

import { Button } from "@/components/ui/button";
import tools from "@/lib/tools.json";
import { Link } from "@tanstack/react-router";

const featuredTools = tools.filter((tool) => tool.featured);

const Home: React.FC = () => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-16">
      <section className="grid gap-6 text-center">
        <span className="mx-auto inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Browser-first toolkit
        </span>
        <h1 className="text-4xl font-semibold md:text-5xl">
          A growing collection of privacy-friendly developer tools
        </h1>
        <p className="mx-auto max-w-2xl text-balance text-sm text-muted-foreground md:text-base">
          Build, test, and ship faster with utilities that run entirely on your
          device. No accounts, no uploads—just helpful tools you control.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/tools">Explore tools</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a
              href="https://github.com/Vossryn/dev-tools"
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub
            </a>
          </Button>
        </div>
      </section>

      <section className="grid gap-6">
        <header className="flex items-center justify-between">
          <div className="grid gap-1">
            <h2 className="text-2xl font-semibold">Featured tools</h2>
          </div>
          <Button asChild variant="ghost">
            <Link to="/tools">See all</Link>
          </Button>
        </header>

        <ul className="grid gap-4 md:grid-cols-2">
          {featuredTools.map((tool) => (
            <li
              key={tool.slug}
              className="rounded-lg border bg-card p-6 text-left shadow-sm transition hover:scale-[1.01] hover:shadow-md"
            >
              <Link to={tool.href} className="grid gap-3">
                <span className="text-xl font-semibold text-primary">
                  {tool.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {tool.description}
                </span>
                <span className="text-sm font-medium text-primary/80">
                  Open tool →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default Home;
