import { createFileRoute } from "@tanstack/react-router";

import YamlLinterTool from "@/features/tools/yaml-linter";

export const Route = createFileRoute("/tools/yaml-linter")({
  component: () => <YamlLinterTool />,
});
