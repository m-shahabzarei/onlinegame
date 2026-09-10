import type { Metadata } from "next";

import { DesignSystemShowcase } from "@/components/design-system/design-system-showcase";

export const metadata: Metadata = {
  title: "Design system",
  description:
    "Internal Phase 1 preview of TwoPlayer design tokens and interface primitives.",
};

export default function DesignSystemPage() {
  return <DesignSystemShowcase />;
}
