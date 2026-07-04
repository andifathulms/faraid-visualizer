"use client";

import { useI18n } from "@/lib/i18n";

// Non-skippable disclaimer on first calculation per session (PRD §7). The disclaimer text
// is a product requirement, not boilerplate (CLAUDE.md).

export default function DisclaimerModal({ onAccept }: { onAccept: () => void }) {
  const { t } = useI18n();
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>{t("disc_modal_title")}</h2>
        <p>{t("disc_modal_body1")}</p>
        <p>{t("disc_modal_body2")}</p>
        <button className="btn" onClick={onAccept}>
          {t("disc_modal_accept")}
        </button>
      </div>
    </div>
  );
}
