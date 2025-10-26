import { createFileRoute } from "@tanstack/react-router";

import ImageConverter from "@/features/tools/image-converter";

export const Route = createFileRoute("/tools/image-converter")({
  component: () => <ImageConverter />,
});
