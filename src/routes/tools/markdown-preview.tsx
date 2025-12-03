import { createFileRoute } from "@tanstack/react-router";

import MarkdownPreviewTool from "@/features/tools/markdown-preview";

export const Route = createFileRoute("/tools/markdown-preview")({
  component: () => <MarkdownPreviewTool />,
});
