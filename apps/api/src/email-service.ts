import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export interface WelcomeEmail {
  name: string;
  email: string;
  tenantName: string;
  role: "tenant.owner" | "tenant.admin";
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });

export class EmailService {
  private readonly transporter: ReturnType<typeof nodemailer.createTransport> | null;
  private readonly from: string;

  public constructor(environment: NodeJS.ProcessEnv = process.env) {
    const host = environment.SMTP_HOST;
    const port = Number(environment.SMTP_PORT);
    const user = environment.SMTP_USER;
    const pass = environment.SMTP_PASS;
    const from = environment.SMTP_FROM;
    this.from = from ?? "Taller ERP <noreply@taller.local>";

    this.transporter =
      host && Number.isInteger(port) && port > 0 && user && pass && from
        ? nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            family: 4,
            socketTimeout: 60_000,
            auth: { user, pass },
          } as SMTPTransport.Options & { family: 4 })
        : null;
  }

  public async sendWelcomeEmail(email: WelcomeEmail): Promise<void> {
    const name = escapeHtml(email.name);
    const tenantName = escapeHtml(email.tenantName);
    const role = escapeHtml(email.role);
    const message = {
      from: this.from,
      to: email.email,
      subject: `Bienvenido a ${email.tenantName} | Taller ERP`,
      html: `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f5f6f1;font-family:Arial,sans-serif;color:#171a15">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e8eae3;border-radius:14px;padding:36px">
          <tr><td>
            <div style="display:inline-block;background:#10120f;color:#a3e635;border-radius:10px;padding:10px 14px;font-size:20px;font-weight:bold">✳</div>
            <h1 style="font-size:24px;margin:24px 0 12px">Bienvenido, ${name}</h1>
            <p style="font-size:15px;line-height:1.6;color:#62685e">Tu cuenta para <strong>${tenantName}</strong> fue creada correctamente.</p>
            <p style="font-size:15px;line-height:1.6;color:#62685e">Tu rol es <strong>administrador del taller</strong> (${role}), con permisos administrativos del tenant.</p>
            <p style="font-size:13px;line-height:1.6;color:#858b80;margin-top:28px">Este mensaje confirma el alta de tu cuenta. No respondas a este correo.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    };

    if (!this.transporter) {
      console.info("[EmailService] SMTP incompleto; correo de bienvenida omitido", {
        to: email.email,
        subject: message.subject,
      });
      return;
    }

    await this.transporter.sendMail(message);
  }
}
