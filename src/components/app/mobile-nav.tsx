"use client";
import { useLocale } from "@/i18n/provider";
import { createTranslator } from "@/i18n/client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { SafeUser } from "@/domain/auth";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  IconButton,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { LanguageSwitcher } from "./language-switcher";
import type { Locale } from "@/i18n/messages";
import { clientTranslate } from "@/i18n/client";

interface MobileNavProps {
  user: SafeUser | null;
  locale?: Locale;
}

const publicLinks = [{ href: "/games" }] as const;

function initials(user: SafeUser) {
  return user.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function MobileNav({ user, locale: explicitLocale }: MobileNavProps) {
  const contextLocale = useLocale();
  const locale = explicitLocale ?? contextLocale;
  const t = createTranslator(locale);

  const copy = {
    games: clientTranslate(locale, "navigation.games"),
    profile: clientTranslate(locale, "navigation.profile"),
    settings: clientTranslate(locale, "navigation.settings"),
    login: clientTranslate(locale, "navigation.login"),
    guest: clientTranslate(locale, "navigation.guest"),
    register: clientTranslate(locale, "navigation.register"),
    logout: clientTranslate(locale, "navigation.logout"),
  };
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<
    "signoutFailure" | "signoutNetwork" | null
  >(null);

  const close = () => setOpen(false);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  async function logout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setLogoutError("signoutFailure");
        return;
      }
      close();
      router.replace("/");
      router.refresh();
    } catch {
      setLogoutError("signoutNetwork");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <nav
      aria-label={t("platform.primaryNav")}
      className="flex items-center gap-2"
    >
      <div className="hidden items-center gap-1 md:flex">
        <LanguageSwitcher locale={locale} />
        {publicLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              isActive(link.href)
                ? "bg-primary-subtle text-primary"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
            aria-current={isActive(link.href) ? "page" : undefined}
          >
            {copy.games}
          </Link>
        ))}
        {user ? (
          <>
            <Link
              href="/profile"
              className={cn(
                "focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                isActive("/profile")
                  ? "bg-primary-subtle text-primary"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
              aria-current={isActive("/profile") ? "page" : undefined}
            >
              {copy.profile}
            </Link>
            <Link
              href="/settings"
              className={cn(
                "focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                isActive("/settings")
                  ? "bg-primary-subtle text-primary"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
              aria-current={isActive("/settings") ? "page" : undefined}
            >
              {copy.settings}
            </Link>
            <div className="border-border relative ms-2 flex items-center gap-2 border-s ps-3">
              <Avatar
                size="sm"
                role="img"
                aria-label={t("platform.avatar", { name: user.displayName })}
              >
                <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
                <AvatarFallback>{initials(user)}</AvatarFallback>
              </Avatar>
              {user.isGuest ? (
                <Badge variant="warning" size="sm">
                  {t("platform.guest")}
                </Badge>
              ) : (
                <span className="text-foreground hidden max-w-28 truncate text-sm font-semibold lg:block">
                  <bdi dir="auto">{user.displayName}</bdi>
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                loading={loggingOut}
                loadingText={t("platform.signingOut")}
                onClick={logout}
                data-leaves-page
                aria-describedby={
                  logoutError ? "desktop-logout-error" : undefined
                }
              >
                {copy.logout}
              </Button>
              {logoutError ? (
                <p
                  id="desktop-logout-error"
                  className="border-destructive/40 bg-destructive-subtle text-destructive shadow-dialog absolute end-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-md border p-3 text-xs leading-5"
                  role="alert"
                >
                  {t(`platform.${logoutError}`)}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="border-border ms-2 flex items-center gap-2 border-s ps-3">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              {copy.login}
            </Link>
            <Link
              href="/continue-as-guest"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              {copy.guest}
            </Link>
            <Link
              href="/register"
              className="border-primary bg-primary text-primary-foreground shadow-glow hover:bg-primary-hover focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {copy.register}
            </Link>
          </div>
        )}
      </div>

      <div className="md:hidden">
        <IconButton
          label={open ? t("platform.closeNav") : t("platform.openNav")}
          variant="outline"
          aria-expanded={open}
          aria-controls="mobile-navigation-panel"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </IconButton>
      </div>

      {open ? (
        <div
          id="mobile-navigation-panel"
          className="border-border bg-surface-elevated shadow-dialog absolute inset-x-4 top-[4.5rem] z-50 rounded-lg border p-3 md:hidden"
        >
          <div className="grid gap-1">
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className={cn(
                  "focus-visible:ring-ring inline-flex min-h-12 items-center rounded-md px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none",
                  isActive(link.href)
                    ? "bg-primary-subtle text-primary"
                    : "text-foreground hover:bg-surface-hover",
                )}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {copy.games}
              </Link>
            ))}
            <div className="border-border flex justify-end border-b pb-1">
              <LanguageSwitcher locale={locale} />
            </div>
            {user ? (
              <>
                <div className="border-border bg-muted/55 mb-2 flex items-center gap-3 rounded-md border p-3">
                  <Avatar
                    size="sm"
                    role="img"
                    aria-label={t("platform.avatar", {
                      name: user.displayName,
                    })}
                  >
                    <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback>{initials(user)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-semibold">
                      {user.isGuest
                        ? t("platform.guestSession")
                        : user.displayName}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {user.isGuest
                        ? t("platform.temporaryIdentity")
                        : `@${user.username}`}
                    </p>
                  </div>
                </div>
                <Link
                  href="/profile"
                  onClick={close}
                  className={cn(
                    "focus-visible:ring-ring inline-flex min-h-12 items-center rounded-md px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none",
                    isActive("/profile")
                      ? "bg-primary-subtle text-primary"
                      : "text-foreground hover:bg-surface-hover",
                  )}
                  aria-current={isActive("/profile") ? "page" : undefined}
                >
                  {copy.profile}
                </Link>
                <Link
                  href="/settings"
                  onClick={close}
                  className={cn(
                    "focus-visible:ring-ring inline-flex min-h-12 items-center rounded-md px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none",
                    isActive("/settings")
                      ? "bg-primary-subtle text-primary"
                      : "text-foreground hover:bg-surface-hover",
                  )}
                  aria-current={isActive("/settings") ? "page" : undefined}
                >
                  {copy.settings}
                </Link>
                <Button
                  className="mt-2 w-full"
                  variant="outline"
                  loading={loggingOut}
                  loadingText={t("platform.signingOut")}
                  onClick={logout}
                  data-leaves-page
                  aria-describedby={
                    logoutError ? "mobile-logout-error" : undefined
                  }
                >
                  {copy.logout}
                </Button>
                {logoutError ? (
                  <p
                    id="mobile-logout-error"
                    className="border-destructive/40 bg-destructive-subtle text-destructive rounded-md border p-3 text-sm leading-5"
                    role="alert"
                  >
                    {t(`platform.${logoutError}`)}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="border-border mt-2 grid gap-2 border-t pt-3">
                <Link
                  href="/login"
                  onClick={close}
                  className="border-border-strong text-foreground hover:bg-surface-hover focus-visible:ring-ring inline-flex min-h-12 items-center justify-center rounded-md border px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  {copy.login}
                </Link>
                <Link
                  href="/register"
                  onClick={close}
                  className="border-primary bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring inline-flex min-h-12 items-center justify-center rounded-md border px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  {copy.register}
                </Link>
                <Link
                  href="/continue-as-guest"
                  onClick={close}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  {t("platform.continueGuest")}
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
