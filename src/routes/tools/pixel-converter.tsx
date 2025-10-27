import { createFileRoute } from "@tanstack/react-router";

import PixelConverter from "@/features/tools/pixel-converter";

export const Route = createFileRoute("/tools/pixel-converter")({
  component: () => <PixelConverter />,
});
