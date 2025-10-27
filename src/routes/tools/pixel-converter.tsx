import { createFileRoute } from "@tanstack/react-router";

import PixelConverter from "@/features/tools/pixel-converter";

// Cast avoids a temporary type error until the route tree regenerates this path.
export const Route = createFileRoute("/tools/pixel-converter" as never)({
  component: () => <PixelConverter />,
});
