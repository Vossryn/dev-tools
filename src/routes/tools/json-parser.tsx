import { createFileRoute } from "@tanstack/react-router";

import JsonParserTool from "@/features/tools/json-parser";

export const Route = createFileRoute("/tools/json-parser")({
  component: () => <JsonParserTool />,
});
