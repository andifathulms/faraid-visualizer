"use client";

// Route-level error boundary (DESIGN.md §8 verification gap / build order step 7).
//
// Before this existed, a render error anywhere in the result pane — EstateFlow, the
// working table, the timeline — took the whole page down to Next.js's default error
// screen, which carries none of this app's branding, language, or explanation. That is
// a materially worse failure mode here than in an ordinary app: a user mid-calculation
// on a page that is explicitly not a legal ruling has no way to tell "the app crashed"
// apart from "the engine correctly refused this case" unless the page keeps talking to
// them in its own voice.
//
// This is that voice. It is deliberately NOT the .unsupported-box amber treatment —
// that one means "the engine is correct and this case isn't supported"; this one means
// "the app itself broke," which is always a bug and always styled as one (.error-box).
//
// Next.js requires error boundaries to be Client Components. This one renders inside
// the root layout, so ThemeProvider/I18nProvider are still mounted (only the page.tsx
// subtree they wrap is replaced) — useI18n and the design tokens are safe to use here.
// Contrast with global-error.tsx, which replaces the root layout itself and cannot
// assume either is available.

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Icon } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="layout" style={{ gridTemplateColumns: "1fr", justifyItems: "center" }}>
      <div className="card card-pad" style={{ maxWidth: 480, width: "100%", marginTop: "var(--sp-16)" }}>
        <div className="error-box" role="alert">
          <Icon name="alert" size={20} />
          <div>
            <strong>{t("error_boundary_title")}</strong>
            <div className="small" style={{ marginTop: "var(--sp-2)" }}>
              {t("error_boundary_body")}
            </div>
          </div>
        </div>
        <div className="row gap-10" style={{ marginTop: "var(--sp-4)", justifyContent: "center" }}>
          <button type="button" className="btn btn-secondary" onClick={() => reset()}>
            <Icon name="refresh" size={15} /> {t("error_boundary_retry")}
          </button>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            {t("error_boundary_reload")}
          </button>
        </div>
      </div>
    </div>
  );
}
