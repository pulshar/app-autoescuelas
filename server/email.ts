import { Resend } from 'resend';

let resendClient: Resend | null = null;
const DEFAULT_AUTHORIZED_TEST_EMAIL = 'alvaroq.dev@gmail.com';

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

export function isSandboxDomain(): boolean {
  const sender = getSenderEmail();
  return sender.includes('resend.dev');
}

export function getAuthorizedTestEmail(): string {
  return process.env.RESEND_TEST_EMAIL?.trim() || DEFAULT_AUTHORIZED_TEST_EMAIL;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
  configured: boolean;
  redirected?: boolean;
  originalRecipient?: string;
  actualRecipient?: string;
  note?: string;
}

/**
 * Sends a transactional HTML email via Resend with graceful sandbox handling
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
  const authorizedTestEmail = getAuthorizedTestEmail();

  // If using onboarding@resend.dev and the recipient is not the authorized developer address,
  // we know upfront that Resend will reject with validation_error unless it goes to the account owner.
  let targetTo = to.trim();
  let wasRedirected = false;

  if (isSandboxDomain() && targetTo.toLowerCase() !== authorizedTestEmail.toLowerCase()) {
    console.log(`[Resend Sandbox] Enrutando envío de "${targetTo}" hacia "${authorizedTestEmail}" para el entorno de desarrollo.`);
    targetTo = authorizedTestEmail;
    wasRedirected = true;
  }

  const sandboxDisclaimerHtml = wasRedirected
    ? `
    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 14px 18px; margin: 0 0 20px 0; font-size: 13px; line-height: 1.5; color: #92400e;">
      <strong>⚠️ Modo Pruebas de Resend (Sandbox):</strong> Este correo estaba destinado a <code>${to}</code>, pero se ha entregado en tu dirección autorizada (<code>${authorizedTestEmail}</code>) porque el remitente utiliza el dominio provisional <code>onboarding@resend.dev</code>.<br>
      <span style="font-size: 11px; color: #b45309; display: block; margin-top: 4px;">
        Para enviar directamente a las direcciones de todos los alumnos sin restricciones, verifica un dominio propio en <a href="https://resend.com/domains" target="_blank" style="color: #b45309; font-weight: bold; text-decoration: underline;">resend.com/domains</a> y define <code>RESEND_FROM_EMAIL</code>.
      </span>
    </div>
    `
    : '';

  const finalHtml = wasRedirected ? sandboxDisclaimerHtml + html : html;
  const finalText = wasRedirected
    ? `[MODO PRUEBAS RESEND: Destinatario original: ${to}]\n\n` + (text || subject)
    : (text || subject);

  try {
    const { data, error } = await client.emails.send({
      from,
      to: targetTo,
      subject: wasRedirected ? `[Sandbox Resend] ${subject}` : subject,
      html: finalHtml,
      text: finalText,
    });

    if (error) {
      // Check if Resend returned a validation error regarding only sending to own address
      if (
        (error as any).name === 'validation_error' ||
        (error as any).statusCode === 403 ||
        error.message?.includes('only send testing emails to your own email address')
      ) {
        // Extract allowed email from error message if available
        const match = error.message.match(/your own email address \(([^)]+)\)/i);
        const fallbackEmail = match ? match[1] : authorizedTestEmail;

        if (targetTo.toLowerCase() !== fallbackEmail.toLowerCase()) {
          console.warn(`[Resend Fallback] Reintentando envío hacia ${fallbackEmail}...`);
          const retryRes = await client.emails.send({
            from,
            to: fallbackEmail,
            subject: `[Sandbox Resend] ${subject}`,
            html: `
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 14px 18px; margin: 0 0 20px 0; font-size: 13px; line-height: 1.5; color: #92400e;">
                <strong>⚠️ Modo Pruebas de Resend (Sandbox):</strong> Correo redirigido desde <code>${to}</code> a <code>${fallbackEmail}</code>.
              </div>
            ` + html,
            text: `[Sandbox Resend: Destinado a ${to}]\n\n` + (text || subject),
          });

          if (!retryRes.error && retryRes.data) {
            console.log(`[Resend Success (Redirected)] Correo entregado a ${fallbackEmail} (ID: ${retryRes.data.id})`);
            return {
              success: true,
              id: retryRes.data.id,
              configured: true,
              redirected: true,
              originalRecipient: to,
              actualRecipient: fallbackEmail,
              note: `Correo entregado en ${fallbackEmail} (Modo Sandbox de Resend).`,
            };
          }
        }
      }

      console.warn('[Resend API Error]', error.message || error);
      return {
        success: false,
        error: error.message || 'Error al enviar correo mediante Resend',
        configured: true,
      };
    }

    console.log(`[Resend Success] Correo enviado a ${targetTo} (ID: ${data?.id})` + (wasRedirected ? ` [Redirigido desde ${to}]` : ''));
    return {
      success: true,
      id: data?.id,
      configured: true,
      redirected: wasRedirected,
      originalRecipient: to,
      actualRecipient: targetTo,
      note: wasRedirected
        ? `Correo entregado con éxito a ${targetTo} (Modo Sandbox Resend). Para enviar a cualquier alumno, verifica un dominio en resend.com.`
        : undefined,
    };
  } catch (err: any) {
    console.warn('[Resend Exception]', err.message || err);
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
                Te recordamos que tienes una clase práctica de conducción programada en tu autoescuela. A continuación encontrarás todos los detalles:
              </p>

              <!-- Class Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600; width: 38%;">
                    Fecha:
                  </td>
                  <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 700;">
                    ${displayDate}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">
                     Hora de inicio:
                  </td>
                  <td style="padding: 6px 0; font-size: 14px; color: #da1249; font-weight: 800;">
                    ${time} (${durationMinutes} min)
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">
                    Profesor:
                  </td>
                  <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 700;">
                    ${teacherName}
                  </td>
                </tr>
                ${location
      ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">
                    Punto de salida:
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


/**
 * Generates and sends a welcome and onboarding email to a newly registered student
 */
export async function sendStudentWelcomeEmail({
  to,
  studentName,
  temporaryPassword,
  appUrl,
}: {
  to: string;
  studentName: string;
  temporaryPassword?: string;
  appUrl?: string;
}): Promise<EmailResult> {
  const baseUrl = (appUrl || process.env.APP_URL || '').replace(/\/$/, '');
  const loginUrl = baseUrl ? `${baseUrl}?login=true&email=${encodeURIComponent(to)}` : '#';
  const subject = `¡Bienvenido/a a AutoescuelaPro! Tu cuenta de alumno ha sido activada`;

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
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #4f46e5; padding: 32px 32px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 10px;">
                      AutoescuelaPro • Portal del Alumno
                    </span>
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; line-height: 1.3;">
                      ¡Bienvenido/a a la Autoescuela!
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #1e293b;">
                Hola <strong>${studentName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Has sido dado de alta en la plataforma oficial de AutoescuelaPro. Ya puedes reservar tus clases prácticas de conducir con tus profesores, ver el calendario disponible y gestionar tus horarios desde tu móvil o cualquier dispositivo.
              </p>

              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding-bottom: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;" colspan="2">
                    🔑 Tus datos de acceso inicial:
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600; width: 35%;">
                    Email / Usuario:
                  </td>
                  <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 700; font-family: monospace;">
                    ${to}
                  </td>
                </tr>
                ${temporaryPassword
      ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">
                    Contraseña provisional:
                  </td>
                  <td style="padding: 6px 0; font-size: 14px; color: #4f46e5; font-weight: 800; font-family: monospace;">
                    ${temporaryPassword}
                  </td>
                </tr>
                `
      : ''
    }
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 34px; border-radius: 14px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);">
                      Acceder a la Plataforma
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Advice Box -->
              <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #92400e;">
                  <strong>Importante:</strong> Te recomendamos cambiar tu contraseña temporal la primera vez que accedas al sistema. Podrás hacerlo en unos segundos entrando en la sección <strong>"Mi perfil"</strong> del menú superior.
                </p>
              </div>

              <!-- Google Login Tip -->
              <div style="background-color: #f1f5f9; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #475569; line-height: 1.5;">
                💡 <em>Consejo: Si tu correo electrónico (<strong style="color: #1e293b;">${to}</strong>) está asociado a una cuenta de Google, también puedes iniciar sesión cómodamente pulsando en el botón <strong>"Continuar con Google"</strong> sin necesidad de recordar contraseñas.</em>
              </div>

              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                Si tienes cualquier duda con tus prácticas, puedes ponerte en contacto con secretaría o consultar directamente en la sede de la autoescuela.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              Este es un correo automático generado por AutoescuelaPro para la activación de tu cuenta de alumno.<br>
              Por favor, no respondas directamente a este mensaje.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `${subject}\n\nHola ${studentName},\n\nEl Administrador Central te ha dado de alta en la plataforma de AutoescuelaPro.\n\nDatos de acceso:\n- Email: ${to}\n${temporaryPassword ? `- Contraseña provisional: ${temporaryPassword}\n` : ''
    }\nEnlace de acceso: ${loginUrl}\n\nIMPORTANTE: Te recomendamos cambiar tu contraseña una vez accedas por primera vez desde la sección "Mi perfil".\n\nSi usas cuenta de Google con este mismo email, también puedes acceder pulsando en "Continuar con Google".\n\n¡Bienvenido/a y feliz aprendizaje!\n`;

  return sendEmail({
    to,
    subject,
    html,
    text,
  });
}