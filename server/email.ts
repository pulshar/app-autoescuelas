import { Resend } from 'resend';

let resendClient: Resend | null = null;

/**
 * Lazy initialization of the Resend SDK client.
 * Does not crash at startup if RESEND_API_KEY is not configured yet.
 */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_RESEND_API_KEY') {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey.trim());
  }
  return resendClient;
}

export function isResendConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY;
  return !!(apiKey && apiKey.trim() !== '' && apiKey !== 'MY_RESEND_API_KEY');
}

export function getSenderEmail(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || 'AutoescuelaPro <onboarding@resend.dev>';
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
  configured: boolean;
}

/**
 * Sends a transactional HTML email via Resend
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const client = getResendClient();
  if (!client) {
    console.warn(`[Resend] Intento de envío a "${to}" omitido: RESEND_API_KEY no está configurada.`);
    return {
      success: false,
      error: 'La variable de entorno RESEND_API_KEY no está configurada en el sistema.',
      configured: false,
    };
  }

  const from = getSenderEmail();

  try {
    const { data, error } = await client.emails.send({
      from,
      to,
      subject,
      html,
      text: text || subject,
    });

    if (error) {
      console.error('[Resend Error]', error);
      return {
        success: false,
        error: error.message || 'Error desconocido al enviar mediante Resend',
        configured: true,
      };
    }

    console.log(`[Resend Success] Correo enviado a ${to} (ID: ${data?.id})`);
    return {
      success: true,
      id: data?.id,
      configured: true,
    };
  } catch (err: any) {
    console.error('[Resend Exception]', err);
    return {
      success: false,
      error: err.message || 'Error en la conexión con la API de Resend',
      configured: true,
    };
  }
}

/**
 * Generates and sends a branded class reminder email
 */
export async function sendClassReminderEmail({
  to,
  studentName,
  teacherName,
  date,
  time,
  durationMinutes,
  location,
  customTitle,
  customMessage,
}: {
  to: string;
  studentName: string;
  teacherName: string;
  date: string;
  time: string;
  durationMinutes: number;
  location?: string;
  customTitle?: string;
  customMessage?: string;
}): Promise<EmailResult> {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const displayDate = match ? `${match[3]}/${match[2]}/${match[1]}` : date;
  const subject = customTitle || `Recordatorio: Clase práctica el ${displayDate} a las ${time}`;
  const appUrl = process.env.APP_URL || '';

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #da1249; padding: 28px 32px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px;">
                      AutoescuelaPro
                    </span>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; line-height: 1.3;">
                      Recordatorio de tu próxima clase práctica
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hola <strong>${studentName}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                ${customMessage
      ? customMessage
      : `Te recordamos que tienes una clase práctica de conducción programada en tu autoescuela. A continuación encontrarás todos los detalles:`
    }
              </p>

              <!-- Class Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600; width: 38%;">
                    📅 Fecha:
                  </td>
                  <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 700;">
                    ${displayDate}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">
                    ⏰ Hora de inicio:
                  </td>
                  <td style="padding: 6px 0; font-size: 14px; color: #da1249; font-weight: 800;">
                    ${time} (${durationMinutes} min)
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">
                    🚗 Profesor:
                  </td>
                  <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 700;">
                    ${teacherName}
                  </td>
                </tr>
                ${location
      ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">
                    📍 Punto de salida:
                  </td>
                  <td style="padding: 6px 0; font-size: 13px; color: #0f172a; font-weight: 600;">
                    ${location}
                  </td>
                </tr>
                `
      : ''
    }
              </table>

              <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                💡 <em>Por favor, llega con 5 minutos de antelación y recuerda llevar tu documento de identidad (DNI/NIE) o permiso de aprendizaje.</em>
              </p>

              ${appUrl
      ? `
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" target="_blank" style="display: inline-block; background-color: #da1249; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 12px; box-shadow: 0 2px 6px rgba(218, 18, 73, 0.25);">
                      Ver mis clases en la plataforma
                    </a>
                  </td>
                </tr>
              </table>
              `
      : ''
    }

              <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Si necesitas modificar o cancelar tu reserva, recuerda hacerlo con la antelación mínima permitida a través de la web o contactando con secretaría.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
              Este es un aviso automático generado por AutoescuelaPro. No respondas directamente a este correo.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: `${subject}\n\nHola ${studentName},\n${customMessage || ''}\n\nFecha: ${displayDate}\nHora: ${time} (${durationMinutes} min)\nProfesor: ${teacherName}\nPunto de salida: ${location || 'Sede central'}\n`,
  });
}
