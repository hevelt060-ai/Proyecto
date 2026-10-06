import { Resend } from "resend";

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
  private readonly resend: Resend | null;
  private readonly from: string;

  public constructor(environment: NodeJS.ProcessEnv = process.env) {
    const apiKey = environment.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = environment.EMAIL_FROM || "Taller ERP <onboarding@resend.dev>";
  }

  public async sendWelcomeEmail(email: WelcomeEmail): Promise<void> {
    if (!this.resend) {
      console.warn("[EmailService] RESEND_API_KEY no configurada; correo omitido", {
        to: email.email,
      });
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: [email.email],
        subject: "Bienvenido al Taller ERP",
        html: `<p>Hola <strong>${escapeHtml(email.name)}</strong>,</p><p>Tu cuenta administrativa ha sido activada con éxito en el sistema ERP.</p>`,
      });
      if (error) console.error("[EmailService] Resend rechazó el correo de bienvenida", error);
    } catch (error) {
      console.error("[EmailService] Error al enviar correo de bienvenida", error);
    }
  }
}
