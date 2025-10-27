import { createFileRoute } from "@tanstack/react-router";

import ColorConverter from "@/features/tools/color-converter";

export const Route = createFileRoute("/tools/color-converter")({
  component: () => <ColorConverter />,
});
