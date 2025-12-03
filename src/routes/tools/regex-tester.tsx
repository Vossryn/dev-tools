import { createFileRoute } from "@tanstack/react-router";

import RegexTester from "@/features/tools/regex-tester";

export const Route = createFileRoute("/tools/regex-tester")({
  component: () => <RegexTester />,
});
