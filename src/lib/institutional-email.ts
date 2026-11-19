// Only ESCOM students can create an account (RN01, RNF06). The sign-up form
// checks this for a friendly message; the server enforces it (lib/auth.ts),
// so calling the auth API directly cannot bypass it. Pure; tested in
// institutional-email.test.ts.

export const INSTITUTIONAL_EMAIL_DOMAIN = "alumno.ipn.mx";
export const INSTITUTIONAL_EMAIL_MESSAGE = `Solo se permiten correos institucionales @${INSTITUTIONAL_EMAIL_DOMAIN}`;

/** True for exactly one "@" followed by the institutional domain (any letter case). */
export function isInstitutionalEmail(email: string): boolean {
  const value = email.trim().toLowerCase();
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) return false;
  return value.slice(at + 1) === INSTITUTIONAL_EMAIL_DOMAIN;
}
