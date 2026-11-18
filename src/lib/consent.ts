// Consent to record the candidate's voice and process it with AI providers.
// Bump CONSENT_VERSION whenever what is collected, who processes it or how
// long it is kept changes: everyone is asked to accept again.
// Shared by client and server (no server imports).

export const CONSENT_VERSION = 1;

export const hasCurrentConsent = (version: number | null | undefined) =>
  typeof version === "number" && version >= CONSENT_VERSION;

export const PRIVACY_PATH = "/privacidad";
