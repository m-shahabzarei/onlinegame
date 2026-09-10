import { getRequestLocale, createTranslator } from "@/i18n";

import { DesignSystemShowcase } from "@/components/design-system/design-system-showcase";

export async function generateMetadata() {
  const t = createTranslator(await getRequestLocale());
  return {
    title: t("pages.designSystem"),
    description: t("pages.internalPhase1PreviewOfTwoPlayerDesignTokensAnd"),
  };
}

export default function DesignSystemPage() {
  return <DesignSystemShowcase />;
}
