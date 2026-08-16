"use client";

// Root-level error boundary (DESIGN.md §8 verification gap / build order step 7).
//
// Only reached if the ROOT LAYOUT itself throws — everything error.tsx protects against
// is a page-level failure with ThemeProvider/I18nProvider/globals.css still intact. This
// one replaces the root layout entirely, so it must not assume ANY of that is available:
// no useI18n (no I18nProvider), no CSS custom properties (no guarantee globals.css
// applied cleanly), no next/font variables. Next.js requires a global-error.tsx to
// render its own <html> and <body>, since it takes the layout's place.
//
// Deliberately plain, hardcoded, inline-styled, and bilingual by literal text rather
// than by a translation lookup — there is nothing left to lean on but the browser itself.

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#f4f1e9",
          color: "#1d1c17",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: "100%",
            background: "#fffefb",
            border: "1px solid #e7e1d3",
            borderRadius: 14,
            padding: 24,
          }}
          role="alert"
        >
          <strong style={{ display: "block", fontSize: 18, marginBottom: 8 }}>
            Terjadi kesalahan yang tidak terduga
          </strong>
          <p style={{ margin: "0 0 8px", fontSize: 14, lineHeight: 1.5, color: "#534e45" }}>
            Halaman ini gagal dimuat sepenuhnya. Data yang sudah Anda masukkan tidak
            terkirim ke mana pun — muat ulang untuk mencoba lagi.
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.5, color: "#726b5e" }}>
            An unexpected error occurred and this page failed to load. Nothing you entered
            was sent anywhere — reload to try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: "inline-block",
              padding: "10px 18px",
              borderRadius: 12,
              border: "none",
              background: "#0f6d51",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Muat ulang / Reload
          </button>
        </div>
      </body>
    </html>
  );
}
