// Shared layout for Agora's transactional emails (verification, password
// reset). Pure functions so they can be tested without sending anything.
//
// Email clients ignore most CSS, so the HTML uses tables, inline styles and
// bgcolor attributes. Every email also carries a plain-text version.
//
// The logo mark is drawn with HTML (a blue tile with an "A"), not an image:
// Outlook, which serves @alumno.ipn.mx, blocks external images by default.

export const BRAND_BLUE = "#516bb7";

export type EmailContent = {
  /** Hidden line shown by inboxes next to the subject. */
  preheader: string;
  heading: string;
  /** User's name; the greeting uses only the first word. */
  name?: string | null;
  intro: string;
  ctaLabel: string;
  /** Link the button opens. */
  url: string;
  /** e.g. "El enlace vence en 24 horas." */
  expiry: string;
  /** Last line before the footer, e.g. what to do if you didn't ask for this. */
  ignoreNote: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "Emiliano Arzate" → "Emiliano"; empty or missing → null. */
export function firstName(name?: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

function greeting(name?: string | null): string {
  const first = firstName(name);
  return first ? `Hola, ${first}.` : "Hola.";
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const e = escapeHtml;

  const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${e(content.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f5f9;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f3f5f9;">${e(content.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f5f9" style="background-color:#f3f5f9;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:480px;background-color:#ffffff;border:1px solid #e4e8f0;border-radius:12px;">
            <tr>
              <td style="padding:32px 32px 0;font-family:Arial,Helvetica,sans-serif;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="44" height="44" align="center" valign="middle" bgcolor="${BRAND_BLUE}" style="width:44px;height:44px;background-color:${BRAND_BLUE};border-radius:10px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:44px;font-weight:bold;color:#ffffff;text-align:center;">A</td>
                    <td style="vertical-align:middle;padding-left:14px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;letter-spacing:1px;color:#1f2937;">AGORA</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0;font-family:Arial,Helvetica,sans-serif;">
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:bold;color:#111827;">${e(content.heading)}</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">${e(greeting(content.name))} ${e(content.intro)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td bgcolor="${BRAND_BLUE}" style="border-radius:8px;background-color:${BRAND_BLUE};">
                      <a href="${e(content.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${e(content.ctaLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${e(content.expiry)} Si el botón no funciona, copia este enlace en tu navegador:</p>
                <p style="margin:4px 0 0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${e(content.url)}" target="_blank" style="color:${BRAND_BLUE};text-decoration:underline;">${e(content.url)}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 28px;font-family:Arial,Helvetica,sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-top:1px solid #eef1f6;padding-top:16px;font-size:12px;line-height:1.6;color:#9ca3af;">
                      ${e(content.ignoreNote)}<br>
                      Agora · Proyecto de Trabajo Terminal, ESCOM-IPN
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "AGORA",
    "",
    content.heading,
    "",
    `${greeting(content.name)} ${content.intro}`,
    "",
    `${content.ctaLabel}:`,
    content.url,
    "",
    content.expiry,
    "",
    content.ignoreNote,
    "Agora · Proyecto de Trabajo Terminal, ESCOM-IPN",
  ].join("\n");

  return { html, text };
}
