"use client";

import { useI18n } from "@/lib/i18n";
import { Icon } from "./ui";

// Non-skippable disclaimer on first calculation per session (PRD §7). The disclaimer text
// is a product requirement, not boilerplate (CLAUDE.md).

export default function DisclaimerModal({ onAccept }: { onAccept: () => void }) {
  const { t } = useI18n();
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-emblem"><Icon name="alert" size={26} /></div>
        <h2>{t("disc_modal_title")}</h2>
        <p>{t("disc_modal_body1")}</p>
        <p>{t("disc_modal_body2")}</p>
        <button className="btn btn-lg" onClick={onAccept} style={{ marginTop: "var(--sp-2)" }}>
          {t("disc_modal_accept")}
        </button>
      </div>
    </div>
  );
}
