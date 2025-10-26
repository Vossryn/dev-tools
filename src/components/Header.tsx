import { Link } from "@tanstack/react-router";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Tools", to: "/tools" },
];

const baseLinkClass =
  "rounded-md px-3 py-2 text-muted-foreground transition hover:text-foreground";
const activeLinkClass =
  "rounded-md bg-primary/10 px-3 py-2 text-foreground";

export default function Header() {
  return (
    <header className="border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <Link to="/" className="text-lg font-semibold">
          Dev Tools
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              inactiveProps={{ className: baseLinkClass }}
              activeProps={{ className: activeLinkClass }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
