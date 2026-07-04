"use client";

// Non-skippable disclaimer on first calculation per session (PRD §7). Shown before the
// first result is revealed; user must acknowledge. The disclaimer text is a product
// requirement, not boilerplate (CLAUDE.md).

export default function DisclaimerModal({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>Sebelum melanjutkan</h2>
        <p>
          Alat ini bersifat <strong>edukasi</strong> dan <strong>bukan</strong> fatwa
          atau putusan hukum yang mengikat. Perhitungan dilakukan secara deterministik
          berdasarkan kaidah faraid yang dirujuk, namun kasus nyata dapat memuat detail
          yang tidak tercakup di sini.
        </p>
        <p>
          Untuk pembagian waris yang sah, konsultasikan dengan{" "}
          <strong>ustadz, notaris, atau PPAIW / Pengadilan Agama</strong>.
        </p>
        <button className="btn" onClick={onAccept}>
          Saya mengerti, lanjutkan
        </button>
      </div>
    </div>
  );
}
