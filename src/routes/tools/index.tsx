import Tools from "@/features/tools/image";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/")({
  component: () => <Tools />,
});
