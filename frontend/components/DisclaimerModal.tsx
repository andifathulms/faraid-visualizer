"use client";

import { useEffect, useId, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./ui";

// Non-skippable disclaimer on first calculation per session (PRD §7). The disclaimer text
// is a product requirement, not boilerplate (CLAUDE.md).
//
// It carried role="dialog" aria-modal="true" and none of the behaviour those imply.
// Measured before this change:
//
//   focus after open  : <button>.btn      still on Calculate, behind the overlay
//   dialog naming     : { labelledby: null, label: null }
//   Tab x8            : OUT OUT in OUT OUT OUT OUT OUT
//   focus after accept: <body>
//
// So a keyboard user pressed Calculate, kept focus behind the overlay, could Tab into the
// page underneath, and on accepting was dumped at the top of the document. A screen reader
// user was never told a dialog had opened, and it had no name.
//
// Escape deliberately does NOT close it. The disclaimer is non-skippable by product
// requirement, and dismissing it without a decision would be exactly the skip PRD §7
// forbids — so the only way out is the button. That is a considered departure from the
// dialog pattern, not an omission.

export default function DisclaimerModal({ onAccept }: { onAccept: () => void }) {
  const { t } = useI18n();
  const titleId = useId();
  const acceptRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // Whatever the user was on when the dialog opened, so focus can go back there.
  const invokerRef = useRef<Element | null>(null);

  useEffect(() => {
    invokerRef.current = document.activeElement;
    acceptRef.current?.focus();

    // aria-modal alone does not stop a screen reader's virtual cursor or the Tab key in
    // every browser, so the rest of the page is genuinely inert while this is open.
    // Computed from the DOM rather than a hardcoded list of landmarks, so a section added
    // to the page later cannot quietly stay reachable behind the overlay.
    const backdrop = Array.from(document.body.children).filter(
      (el) => !el.contains(overlayRef.current)
    );
    for (const el of backdrop) el.setAttribute("inert", "");

    return () => {
      for (const el of backdrop) el.removeAttribute("inert");

      // Return focus to whatever opened the dialog, so a keyboard user resumes where they
      // were instead of at the top of the document.
      //
      // Deferred by a frame on purpose. Removing the focused dialog from the DOM makes the
      // browser reset focus to <body>, and that reset lands AFTER this cleanup runs —
      // focusing synchronously here is silently undone. Measured against the production
      // build: focus ended on <body> until this was deferred.
      const el = invokerRef.current;
      if (!(el instanceof HTMLElement)) return;
      requestAnimationFrame(() => {
        if (el.isConnected) el.focus();
      });
    };
  }, []);

  /**
   * Keep Tab inside the dialog. There is exactly one focusable element in here, so the
   * trap is just "swallow Tab" — but it is written against the real focusable list so
   * adding a second control later does not silently break it.
   */
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const focusables = overlayRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables?.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !overlayRef.current?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !overlayRef.current?.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
    >
      <div className="modal">
        <div className="modal-emblem"><Icon name="alert" size={26} /></div>
        <h2 id={titleId}>{t("disc_modal_title")}</h2>
        <p>{t("disc_modal_body1")}</p>
        <p>{t("disc_modal_body2")}</p>
        <button ref={acceptRef} className="btn btn-lg" onClick={onAccept} style={{ marginTop: "var(--sp-2)" }}>
          {t("disc_modal_accept")}
        </button>
      </div>
    </div>
  );
}
