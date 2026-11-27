import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, firstName, renderEmail, type EmailContent } from "./email-template";

const base: EmailContent = {
  preheader: "Confirma tu correo",
  heading: "Confirma tu correo",
  name: "Ana López",
  intro: "Confirma que este correo es tuyo.",
  ctaLabel: "Verificar mi correo",
  url: "https://agora-hub.vercel.app/api/auth/verify-email?token=abc&callbackURL=%2Femail-verified",
  expiry: "El enlace vence en 24 horas.",
  ignoreNote: "Si no creaste una cuenta en Agora, ignora este correo.",
};

test("firstName keeps only the first word", () => {
  assert.equal(firstName("  Ana   López "), "Ana");
  assert.equal(firstName(""), null);
  assert.equal(firstName(null), null);
});

test("escapeHtml escapes markup characters", () => {
  assert.equal(escapeHtml(`<b>"x" & 'y'</b>`), "&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;");
});

test("the user's name cannot inject HTML", () => {
  const { html } = renderEmail({ ...base, name: "<script>alert(1)</script>" });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("Hola, &lt;script&gt;alert(1)&lt;/script&gt;."));
});

test("the logo is served from the link's origin", () => {
  const { html } = renderEmail(base);
  assert.ok(html.includes(`src="https://agora-hub.vercel.app/email/agora-logo.png"`));
  const local = renderEmail({ ...base, url: "http://localhost:3000/api/auth/verify-email?token=x" });
  assert.ok(local.html.includes(`src="http://localhost:3000/email/agora-logo.png"`));
});

test("the link is escaped in attributes and kept intact in the text version", () => {
  const { html, text } = renderEmail(base);
  assert.ok(html.includes(`href="https://agora-hub.vercel.app/api/auth/verify-email?token=abc&amp;callbackURL=%2Femail-verified"`));
  assert.ok(text.includes(base.url));
  assert.ok(text.includes("Hola, Ana. Confirma que este correo es tuyo."));
});

test("without a name the greeting is generic", () => {
  const { text } = renderEmail({ ...base, name: undefined });
  assert.ok(text.includes("Hola. Confirma que este correo es tuyo."));
});
