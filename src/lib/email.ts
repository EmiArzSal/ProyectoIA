import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER!,
    pass: process.env.GMAIL_APP_PASSWORD!,
  },
});

export async function sendVerificationEmail(email: string, url: string) {
  await transporter.sendMail({
    from: `"Agora IPN" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Verifica tu correo — Agora",
    html: `
      <!DOCTYPE html>
      <html lang="es">
        <body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
            <tr>
              <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px;text-align:center;">
                      <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">AGORA</h1>
                      <p style="margin:6px 0 0;color:#bfdbfe;font-size:13px;">Plataforma de práctica de entrevistas en inglés</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:36px 40px;">
                      <h2 style="margin:0 0 12px;color:#111827;font-size:20px;font-weight:600;">Verifica tu correo institucional</h2>
                      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                        Haz clic en el botón de abajo para activar tu cuenta. Este enlace es válido por <strong>24 horas</strong>.
                      </p>
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="border-radius:8px;background:#2563eb;">
                            <a href="${url}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                              Verificar mi correo
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;line-height:1.6;">
                        Si no creaste una cuenta en Agora, ignora este correo.<br>
                        Si el botón no funciona, copia y pega este enlace:<br>
                        <a href="${url}" style="color:#2563eb;word-break:break-all;">${url}</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center;">
                      <p style="margin:0;color:#d1d5db;font-size:12px;">
                        Agora · Instituto Politécnico Nacional · Solo para alumnos @alumno.ipn.mx
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}
