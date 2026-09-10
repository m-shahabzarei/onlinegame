"use client";
import { createTranslator } from "@/i18n/client";
import { useLocale } from "@/i18n/provider";
import Link from "next/link";
import { Button, buttonVariants, Card } from "@/components/ui";
export default function RoomError({ retry }: { retry(): void }) {
  const t = createTranslator(useLocale());

  return (
    <div className="px-4 py-12">
      <Card padding="lg" className="mx-auto max-w-xl space-y-5">
        <h1 className="font-display text-2xl">
          {t("pages.theRoomCouldNotLoad")}
        </h1>
        <p role="alert" className="text-muted-foreground">
          {t("pages.yourInviteIsStillInTheAddressBarRetry")}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={retry}>{t("pages.retry")}</Button>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/games/nightfall-protocol/rooms"
          >
            {t("pages.backToRooms")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
