"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLinkStatus } from "next/link";

/** Gives slow-network navigations immediate feedback and records a small timing signal. */
export function RouteProgress() {
  const { pending } = useLinkStatus();
  const pathname = usePathname();
  useEffect(() => {
    if (typeof performance === "undefined") return;
    performance.mark(`route:${pathname}:ready`);
    try {
      performance.measure(
        `route:${pathname}:transition`,
        "route:navigation:start",
        `route:${pathname}:ready`,
      );
    } catch {
      // Initial render has no navigation start mark.
    }
  }, [pathname]);
  useEffect(() => {
    const mark = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        !(event.target instanceof Element)
      )
        return;
      const anchor = event.target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin === window.location.origin &&
        destination.pathname !== window.location.pathname
      )
        performance.mark("route:navigation:start");
    };
    document.addEventListener("click", mark, true);
    return () => document.removeEventListener("click", mark, true);
  }, []);
  return (
    <span
      aria-hidden="true"
      className={`route-progress ${pending ? "is-pending" : ""}`}
    />
  );
}
