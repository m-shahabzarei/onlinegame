"use client";
import { useEffect, useRef } from "react";
import { Button, Card } from "@/components/ui";
import { WEAPONS, UPGRADES } from "@/game/shared/phase6";
import { clientTranslate } from "@/i18n/client";
import { messages, type Locale } from "@/i18n/messages";
export interface Phase6ShopProps {
  open: boolean;
  scrap: number;
  ownedWeapons: string[];
  equippedWeapon: string;
  onPurchase: (
    kind:
      "weapon" | "ammo" | "upgrade" | "armor" | "medkit" | "grenade" | "sentry",
    id?: string,
  ) => void;
  onClose: () => void;
  locale?: Locale;
}
export function Phase6Shop({
  open,
  scrap,
  ownedWeapons,
  equippedWeapon,
  onPurchase,
  onClose,
  locale = "en",
}: Phase6ShopProps) {
  const close = useRef<HTMLButtonElement>(null);
  const t = (key: `shop.${keyof typeof messages.en.shop & string}`) =>
    clientTranslate(locale, key);
  useEffect(() => {
    if (open) close.current?.focus();
  }, [open]);
  if (!open) return null;
  const support: [
    Phase6ShopProps["onPurchase"] extends (kind: infer K, id?: string) => void
      ? K
      : never,
    string,
    number,
  ][] = [
    ["ammo", t("shop.ammo"), 35],
    ["armor", t("shop.armor"), 80],
    ["medkit", t("shop.medkit"), 60],
    ["grenade", t("shop.grenade"), 45],
    ["sentry", t("shop.sentry"), 180],
  ];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-title"
      className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-4"
    >
      <Card className="border-primary/40 bg-background/95 max-h-[90vh] w-full max-w-3xl overflow-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
              {t("shop.safeRoom")}
            </p>
            <h2 id="shop-title" className="font-display text-2xl">
              {t("shop.title")}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs">{t("shop.scrap")}</p>
            <strong className="font-mono text-xl tabular-nums">{scrap}</strong>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="weapons-heading">
            <h3 id="weapons-heading" className="mb-2 font-semibold">
              {t("shop.weapons")}
            </h3>
            <div className="grid gap-2">
              {WEAPONS.map((w) => {
                const owned = ownedWeapons.includes(w.id);
                return (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium">{w.displayName}</p>
                      <p className="text-muted-foreground text-xs">
                        {w.description} · {w.baseDamage} dmg ·{" "}
                        {w.magazineCapacity} mag
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={owned ? "secondary" : "primary"}
                      disabled={owned || scrap < w.shopCost}
                      onClick={() => onPurchase("weapon", w.id)}
                    >
                      {owned
                        ? w.id === equippedWeapon
                          ? t("shop.equipped")
                          : t("shop.owned")
                        : `${w.shopCost} ${t("shop.scrap")}`}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
          <section aria-labelledby="support-heading">
            <h3 id="support-heading" className="mb-2 font-semibold">
              {t("shop.support")}
            </h3>
            <div className="grid gap-2">
              {support.map(([kind, label, cost]) => (
                <div
                  key={kind}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <span>{label}</span>
                  <Button
                    size="sm"
                    disabled={scrap < cost}
                    onClick={() => onPurchase(kind)}
                  >
                    {cost} {t("shop.scrap")}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
        <section aria-labelledby="upgrade-heading" className="mt-4">
          <h3 id="upgrade-heading" className="mb-2 font-semibold">
            {t("shop.upgrades")}
          </h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {UPGRADES.filter((u) => ownedWeapons.includes(u.weaponId)).map(
              (u) => (
                <Button
                  key={u.id}
                  variant="secondary"
                  disabled={scrap < u.cost}
                  onClick={() => onPurchase("upgrade", u.id)}
                >
                  {u.weaponId} · Lv {u.level} · {u.cost}
                </Button>
              ),
            )}
          </div>
        </section>
        <div className="mt-5 flex justify-end">
          <Button ref={close} variant="secondary" onClick={onClose}>
            {t("shop.close")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
