"use client";

import { useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui";
import {
  WEAPONS,
  UPGRADES,
  SHOP_ITEMS,
  resolveWeaponStats,
  type Phase6PlayerState,
} from "@/game/shared/phase6";
import type { ShopFeedback } from "@/game/client/pve-hud";
import { createTranslator, formatNumber } from "@/i18n/client";
import type { Locale } from "@/i18n/messages";

type WeaponId =
  keyof typeof import("@/i18n/game-messages").gameMessages.en.weaponNames;
const weaponKey = (id: string) => id as WeaponId;
export function shopFeedbackText(
  locale: Locale,
  feedback: ShopFeedback | null,
) {
  if (!feedback) return "";
  const t = createTranslator(locale);
  if (feedback.code !== "accepted") return t(`shopResults.${feedback.code}`);
  if (feedback.weaponId && WEAPONS.some((w) => w.id === feedback.weaponId)) {
    const weapon = t(`weaponNames.${weaponKey(feedback.weaponId)}`);
    return feedback.kind === "equip"
      ? t("gameShop.equippedSuccess", { weapon })
      : t("gameShop.success", { weapon });
  }
  return t("gameShop.itemSuccess");
}
export interface Phase6ShopProps {
  open: boolean;
  loadout: Phase6PlayerState | null;
  seconds: number;
  wave: number;
  pending: boolean;
  feedback: ShopFeedback | null;
  onPurchase: (
    kind: "weapon" | "ammo" | "upgrade",
    id?: string,
    replaceWeaponId?: string,
  ) => void;
  onEquip: (id: string, slot: "primary" | "secondary") => void;
  onClose: () => void;
  onReturn: () => void;
  restoreFocus: () => void;
  locale: Locale;
}
/** Two selected slots, permanent ownership for this run, purchases auto-equip. */
export function Phase6Shop({
  open,
  loadout,
  seconds,
  wave,
  pending,
  feedback,
  onPurchase,
  onEquip,
  onClose,
  onReturn,
  restoreFocus,
  locale,
}: Phase6ShopProps) {
  const close = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [replacement, setReplacement] = useState<string | null>(null);
  const t = createTranslator(locale);
  const name = (id: string) => t(`weaponNames.${weaponKey(id)}`);
  const n = (value: number) =>
    formatNumber(locale, value, { maximumFractionDigits: 1 });
  const active = WEAPONS.find((w) => w.id === loadout?.equippedWeapon);
  const replacing = WEAPONS.find((w) => w.id === replacement);
  const previous = replacing && loadout?.slots[replacing.slot];
  const available = seconds > 0 && !!loadout;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReplacement(null);
          onClose();
        }
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] max-w-4xl gap-4 p-4 sm:p-6"
        closeLabel={t("common.close")}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          heading.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
          setReplacement(null);
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 pe-10">
          <div>
            <p className="text-primary text-sm">{t("gameShop.safeRoom")}</p>
            <DialogTitle ref={heading} tabIndex={-1}>
              {t("gameShop.title")}
            </DialogTitle>
          </div>
          <div className="text-end tabular-nums">
            <strong>
              {t("gameShop.cost", { count: loadout?.scrap ?? 0 })}
            </strong>
            <p role="timer" aria-live="off">
              {t("gameShop.countdown", { count: seconds })}
            </p>
          </div>
        </div>
        <DialogDescription>{t("gameShop.rules")}</DialogDescription>
        <p
          className="text-primary min-h-6 text-sm"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {pending ? t("gameShop.pending") : shopFeedbackText(locale, feedback)}
        </p>
        <div className="flex flex-wrap gap-3" aria-label={t("gameShop.slots")}>
          {(["primary", "secondary"] as const).map((slot) => (
            <p key={slot} className="text-muted-foreground text-sm">
              {t(`gameShop.${slot}`)} ·{" "}
              {loadout?.slots[slot]
                ? name(loadout.slots[slot]!)
                : t("gameShop.emptySecondary")}
            </p>
          ))}
        </div>
        {replacing && previous && available && (
          <section
            className="border-primary bg-primary-subtle grid gap-3 rounded-md border p-4"
            aria-labelledby="replace-heading"
          >
            <h3 id="replace-heading" className="font-semibold">
              {t("gameShop.replace")}
            </h3>
            <p>
              {t("gameShop.replaceHelp", {
                weapon: name(replacing.id),
                previous: name(previous),
              })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                className="min-h-11 min-w-11"
                disabled={pending || (loadout?.scrap ?? 0) < replacing.shopCost}
                onClick={() => {
                  onPurchase("weapon", replacing.id, previous);
                  setReplacement(null);
                }}
              >
                {t("gameShop.confirm")}
              </Button>
              <Button
                variant="secondary"
                className="min-h-11 min-w-11"
                onClick={() => setReplacement(null)}
              >
                {t("gameShop.cancel")}
              </Button>
            </div>
          </section>
        )}
        <section aria-labelledby="shop-weapons">
          <h3 id="shop-weapons" className="mb-3 font-semibold">
            {t("gameShop.weapons")}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {WEAPONS.map((w) => {
              const owned = !!loadout?.ownedWeapons.includes(w.id),
                equipped = loadout?.equippedWeapon === w.id;
              const level = loadout?.upgrades[w.id] ?? 0,
                stats = resolveWeaponStats(w.id, level),
                ammo = loadout?.ammo[w.id];
              const reason = !available
                ? t("gameShop.closed")
                : !owned && wave < w.unlockWave
                  ? t("gameShop.locked", { count: w.unlockWave })
                  : !owned && (loadout?.scrap ?? 0) < w.shopCost
                    ? t("gameShop.noScrap")
                    : "";
              return (
                <article
                  key={w.id}
                  className="border-border grid content-start gap-2 rounded-md border p-3"
                  data-weapon={w.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold">{name(w.id)}</h4>
                    <span className="text-muted-foreground text-xs">
                      {t(`gameShop.${w.slot}`)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {t(`weaponDescriptions.${weaponKey(w.id)}`)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t("gameShop.stats", {
                      damage: n(stats.baseDamage),
                      range: stats.range,
                      magazine: stats.magazineCapacity,
                    })}
                  </p>
                  <p className="text-xs">
                    {t("gameShop.unlock", { count: w.unlockWave })} ·{" "}
                    {t("gameShop.level", { count: level })}
                  </p>
                  {ammo && (
                    <p className="text-sm tabular-nums">
                      {t("gameShop.ammo", {
                        magazine: ammo.magazine,
                        reserve: ammo.reserve,
                      })}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {owned
                      ? t(equipped ? "gameShop.equipped" : "gameShop.owned")
                      : t("gameShop.cost", { count: w.shopCost })}
                  </p>
                  <Button
                    variant={owned ? "secondary" : "primary"}
                    className="min-h-11 min-w-11"
                    disabled={pending || !!reason || equipped}
                    onClick={() => {
                      if (owned) onEquip(w.id, w.slot);
                      else if (loadout?.slots[w.slot]) setReplacement(w.id);
                      else onPurchase("weapon", w.id);
                    }}
                  >
                    {owned
                      ? t(equipped ? "gameShop.equipped" : "gameShop.equip")
                      : t("gameShop.buy")}
                  </Button>
                  {reason && (
                    <p className="text-muted-foreground text-xs">{reason}</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
        <section aria-labelledby="shop-upgrades">
          <h3 id="shop-upgrades" className="mb-3 font-semibold">
            {t("gameShop.upgrades")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {WEAPONS.filter((w) => loadout?.ownedWeapons.includes(w.id)).map(
              (w) => {
                const level = loadout?.upgrades[w.id] ?? 0,
                  upgrade = UPGRADES.find(
                    (u) => u.weaponId === w.id && u.prerequisiteLevel === level,
                  );
                return (
                  <div
                    key={w.id}
                    className="border-border grid gap-2 rounded-md border p-3"
                  >
                    <span>
                      {name(w.id)} · {t("gameShop.level", { count: level })}
                    </span>
                    {upgrade ? (
                      <>
                        <p>{t("gameShop.cost", { count: upgrade.cost })}</p>
                        <Button
                          className="min-h-11 min-w-11 whitespace-normal"
                          variant="secondary"
                          disabled={
                            !available ||
                            pending ||
                            (loadout?.scrap ?? 0) < upgrade.cost
                          }
                          onClick={() => onPurchase("upgrade", upgrade.id)}
                        >
                          {t("gameShop.upgrade", {
                            weapon: name(w.id),
                            count: upgrade.level,
                          })}
                        </Button>
                        {(loadout?.scrap ?? 0) < upgrade.cost && (
                          <p className="text-muted-foreground text-xs">
                            {t("gameShop.noScrap")}
                          </p>
                        )}
                      </>
                    ) : (
                      <p>{t("gameShop.maxUpgrade")}</p>
                    )}
                  </div>
                );
              },
            )}
          </div>
        </section>
        <section aria-labelledby="shop-support">
          <h3 id="shop-support" className="mb-3 font-semibold">
            {t("gameShop.support")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border grid gap-2 rounded-md border p-3">
              <span>{t("gameShop.ammoRefill")}</span>
              {active && <span>{name(active.id)}</span>}
              <p>{t("gameShop.cost", { count: SHOP_ITEMS[0]!.cost })}</p>
              <Button
                className="min-h-11 min-w-11"
                disabled={
                  !available ||
                  pending ||
                  !active ||
                  (loadout?.scrap ?? 0) < SHOP_ITEMS[0]!.cost ||
                  (loadout?.ammo[active?.id ?? ""]?.reserve ?? 0) >=
                    (active?.reserveCapacity ?? 0)
                }
                onClick={() => onPurchase("ammo", active?.id)}
              >
                {t("gameShop.buy")}
              </Button>
              {active &&
              (loadout?.ammo[active.id]?.reserve ?? 0) >=
                active.reserveCapacity ? (
                <p className="text-muted-foreground text-xs">
                  {t("gameShop.full")}
                </p>
              ) : (
                (loadout?.scrap ?? 0) < SHOP_ITEMS[0]!.cost && (
                  <p className="text-muted-foreground text-xs">
                    {t("gameShop.noScrap")}
                  </p>
                )
              )}
            </div>
            {(["armor", "medkit", "grenade", "sentry", "gate"] as const).map(
              (kind) => (
                <div
                  key={kind}
                  className="border-border grid gap-2 rounded-md border p-3"
                >
                  <span>{t(`gameShop.${kind}`)}</span>
                  <p className="text-muted-foreground text-xs">
                    {t("gameShop.unavailable")}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>
        <div className="bg-surface-elevated sticky bottom-0 flex flex-wrap justify-end gap-3 pt-3">
          <Button
            ref={close}
            className="min-h-11 min-w-11"
            variant="secondary"
            onClick={() => {
              setReplacement(null);
              onClose();
            }}
          >
            {t("gameShop.close")}
          </Button>
          <Button
            className="min-h-11 min-w-11"
            onClick={() => {
              setReplacement(null);
              onReturn();
            }}
          >
            {t("gameShop.return")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
