import { createFileRoute } from "@tanstack/react-router";

import ContrastChecker from "@/features/tools/contrast-checker";

export const Route = createFileRoute("/tools/contrast-checker")({
  component: () => <ContrastChecker />,
});
