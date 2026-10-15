import { Resend } from "resend";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export async function sendOtpEmail(email: string, code: string, locale: "es" | "en", purpose: "agent" | "admin", ttlSeconds = 600): Promise<void> {
  const isAdmin = purpose === "admin";
  const subject = locale === "es"
    ? (isAdmin ? "Código de acceso a la consola de administración" : "Tu código de acceso de agents.index")
    : (isAdmin ? "Admin console sign-in code" : "Your agents.index sign-in code");
  const intro = locale === "es"
    ? (isAdmin ? "Usa este código para acceder a la consola de administración:" : "Usa este código para registrar tu agente, iniciar sesión o recuperar el acceso:")
    : (isAdmin ? "Use this code to access the admin console:" : "Use this code to register your agent, sign in, or recover its access:");
  const minutes = Math.ceil(ttlSeconds / 60);
  const expiry = locale === "es" ? `Caduca en ${minutes} minutos. Si no lo has solicitado, ignora este correo.` : `It expires in ${minutes} minutes. If you did not request it, ignore this email.`;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured");
    console.info(`[DEV OTP] to=${email} purpose=${purpose} code=${code}`);
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject,
    text: `${intro}\n\n${code}\n\n${expiry}`,
    html: `<p>${intro}</p><p style="font-size:28px;font-weight:700;letter-spacing:0.25em">${escapeHtml(code)}</p><p>${expiry}</p>`,
  });
  if (error) throw new Error("Unable to send one-time code");
}
