"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "@/i18n/provider";
const HISTORY_GUARD_KEY = "__twoplayerUnsavedChangesGuard";

/** Warn for full-page exits and intercept same-origin client navigation. */
export function useUnsavedChangesWarning(
  dirty: boolean,
  explicitMessage?: string,
): void {
  const t = useTranslations();
  const message = explicitMessage ?? t("platform.unsavedChanges");
  const messageRef = useRef(message);
  useEffect(() => {
    messageRef.current = message;
  }, [message]);
  useEffect(() => {
    if (!dirty) return;

    const guardId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const guardedUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const guardedState = {
      ...(typeof window.history.state === "object" &&
      window.history.state !== null
        ? window.history.state
        : {}),
      [HISTORY_GUARD_KEY]: guardId,
    };
    let allowHistoryNavigation = false;
    let bypassElement: HTMLElement | null = null;
    let pendingGuardRemoval: (() => void) | null = null;

    // A same-URL history entry lets us ask before Back/Forward commits to a
    // different App Router entry. Declining restores this guard in place.
    window.history.pushState(guardedState, "", guardedUrl);

    const removeGuardThen = (continuation: () => void) => {
      allowHistoryNavigation = true;
      pendingGuardRemoval = () => {
        pendingGuardRemoval = null;
        continuation();
      };
      window.addEventListener("popstate", pendingGuardRemoval, { once: true });
      window.history.back();
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowHistoryNavigation) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }
      const explicitNavigation = event.target.closest("[data-leaves-page]");
      if (explicitNavigation) {
        if (explicitNavigation === bypassElement) {
          bypassElement = null;
          return;
        }
        if (!window.confirm(messageRef.current)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (
          explicitNavigation instanceof HTMLAnchorElement &&
          window.history.state?.[HISTORY_GUARD_KEY] === guardId
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          removeGuardThen(() => {
            bypassElement = explicitNavigation;
            explicitNavigation.click();
          });
        }
        return;
      }

      const anchor = event.target.closest("a[href]");
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")
      ) {
        return;
      }
      if (anchor === bypassElement) {
        bypassElement = null;
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;

      const staysOnDocument =
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search;
      if (staysOnDocument) return;

      if (!window.confirm(messageRef.current)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (window.history.state?.[HISTORY_GUARD_KEY] === guardId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        removeGuardThen(() => {
          bypassElement = anchor;
          anchor.click();
        });
      }
    };

    const handlePopState = () => {
      if (allowHistoryNavigation) return;

      if (window.confirm(messageRef.current)) {
        allowHistoryNavigation = true;
        window.history.back();
        return;
      }

      window.history.pushState(guardedState, "", guardedUrl);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
      if (pendingGuardRemoval) {
        window.removeEventListener("popstate", pendingGuardRemoval);
      }

      // Successful saves remove the same-URL guard without creating a dead
      // Back-button step. During real navigation the current entry has already
      // changed, so this branch intentionally does nothing.
      if (
        window.history.state?.[HISTORY_GUARD_KEY] === guardId &&
        `${window.location.pathname}${window.location.search}${window.location.hash}` ===
          guardedUrl
      ) {
        allowHistoryNavigation = true;
        window.history.back();
      }
    };
  }, [dirty]);
}
