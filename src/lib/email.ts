import nodemailer from "nodemailer";
import { renderEmail } from "@/lib/email-template";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER!,
    pass: process.env.GMAIL_APP_PASSWORD!,
  },
});

const FROM = `"Agora IPN" <${process.env.GMAIL_USER}>`;

export async function sendVerificationEmail(email: string, url: string, name?: string | null) {
  const { html, text } = renderEmail({
    preheader: "Confirma tu correo para activar tu cuenta de Agora.",
    heading: "Confirma tu correo",
    name,
    intro: "Ya casi está lista tu cuenta para practicar entrevistas en inglés. Confirma que este correo es tuyo para activarla.",
    ctaLabel: "Verificar mi correo",
    url,
    expiry: "El enlace vence en 24 horas.",
    ignoreNote: "Si no creaste una cuenta en Agora, ignora este correo.",
  });

  await transporter.sendMail({ from: FROM, to: email, subject: "Verifica tu correo — Agora", html, text });
}

export async function sendResetPasswordEmail(email: string, url: string, name?: string | null) {
  const { html, text } = renderEmail({
    preheader: "Elige una nueva contraseña para tu cuenta de Agora.",
    heading: "Restablece tu contraseña",
    name,
    intro: "Recibimos una solicitud para restablecer la contraseña de tu cuenta. Elige una nueva con el siguiente botón.",
    ctaLabel: "Restablecer mi contraseña",
    url,
    expiry: "El enlace vence en 1 hora.",
    ignoreNote: "Si no pediste este cambio, ignora este correo; tu contraseña actual no cambiará.",
  });

  await transporter.sendMail({ from: FROM, to: email, subject: "Restablece tu contraseña — Agora", html, text });
}
