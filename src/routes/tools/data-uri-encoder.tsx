import { createFileRoute } from "@tanstack/react-router";

import DataUriEncoder from "@/features/tools/data-uri-encoder";

export const Route = createFileRoute("/tools/data-uri-encoder")({
  component: () => <DataUriEncoder />,
});
