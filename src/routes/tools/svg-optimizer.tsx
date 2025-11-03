import { createFileRoute } from "@tanstack/react-router";

import SvgOptimizer from "@/features/tools/svg-optimizer";

export const Route = createFileRoute("/tools/svg-optimizer")({
  component: () => <SvgOptimizer />,
});
