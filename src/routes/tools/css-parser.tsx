import { createFileRoute } from "@tanstack/react-router";

import CssParserTool from "@/features/tools/css-parser";

export const Route = createFileRoute("/tools/css-parser")({
  component: () => <CssParserTool />,
});
