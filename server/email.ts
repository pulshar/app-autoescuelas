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

export function getSenderEmail(schoolName: string = 'AutoescuelaPro'): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || `${schoolName} <onboarding@resend.dev>`;
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
  schoolName,
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
  schoolName?: string;
}): Promise<EmailResult> {
  const brandName = schoolName || 'AutoescuelaPro';
  const brandColor = '#19887f';
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const displayDate = match ? `${match[3]}/${match[2]}/${match[1]}` : date;
  const subject = customTitle || `Recordatorio: Clase práctica el ${displayDate} a las ${time}`;
  const baseUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const loginUrl = baseUrl ? `${baseUrl}?login=true&email=${encodeURIComponent(to)}` : '#';

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 8px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: ${brandColor}; padding: 32px 32px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 10px;">
                      ${brandName}
                    </span>
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; line-height: 1.3;">
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
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600; width: 38%;">
                    Fecha:
                  </td>
                  <td style="padding: 6px 0; font-size: 14px; color: ${brandColor}; font-weight: 600;">
                    ${displayDate}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">
                     Hora de inicio:
                  </td>
                  <td style="padding: 6px 0; font-size: 14px; color: ${brandColor}; font-weight: 600;">
                    ${time} (${durationMinutes} min)
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">
                    Profesor:
                  </td>
                  <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">
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

              ${baseUrl
      ? `
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" target="_blank" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 34px; border-radius: 8px;">
                      Ver mis clases en la plataforma
                    </a>
                  </td>
                </tr>
              </table>
              `
      : ''
    }

              <div style="margin:0; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Si necesitas modificar o cancelar tu reserva, recuerda hacerlo con la antelación mínima permitida a través de la web o contactando con la autoescuela.
              </div>
            </td>
          </tr>

          <!-- Footer -->
           <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              Notificación generada automáticamente por ${brandName}.<br>
              Por favor, no respondas a este correo.
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
  schoolName,
}: {
  to: string;
  studentName: string;
  temporaryPassword?: string;
  appUrl?: string;
  schoolName?: string;
}): Promise<EmailResult> {
  const brandName = schoolName || 'AutoescuelaPro';
  const brandColor = '#19887f';
  const baseUrl = (appUrl || process.env.APP_URL || '').replace(/\/$/, '');
  const loginUrl = baseUrl ? `${baseUrl}?login=true&email=${encodeURIComponent(to)}` : '#';
  const subject = `¡Bienvenido/a a ${brandName}! Tu cuenta de alumno ha sido activada`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 8px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: ${brandColor}; padding: 32px 32px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 10px;">
                      ${brandName}
                    </span>
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; line-height: 1.3;">
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
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #1e293b;">
                Hola <strong>${studentName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Has sido dado de alta en la plataforma oficial de ${brandName}. Ya puedes reservar tus clases prácticas de conducir con tus profesores, ver el calendario disponible y gestionar tus horarios desde tu móvil o cualquier dispositivo.
              </p>

              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 12px;">
                <tr>
                  <td style="padding-bottom: 12px; margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;" colspan="2">
                   Tus datos de acceso inicial:
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
                  <td style="padding: 6px 0; font-size: 14px; color: ${brandColor}; font-weight: 800; font-family: monospace;">
                    ${temporaryPassword}
                  </td>
                </tr>
                `
      : ''
    }
              </table>

              <!-- Security Advice Box -->
              <div style="background-color: #fffbeb; border: 1px solid #fde896; border-radius: 10px; padding: 14px 16px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #92400e;">
                 <strong>Importante:</strong> Te recomendamos cambiar tu contraseña temporal la primera vez que accedas al sistema. Podrás hacerlo en la sección <em>"Mi perfil"</em> del menú superior.
                </p>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" target="_blank" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 34px; border-radius: 8px;">
                      Acceder a la Plataforma
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Google Login Tip -->
              <div style="background-color: #f1f5f9; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; color: #475569; line-height: 1.5;">
                💡 <em>Si tu correo electrónico (<strong style="color: #1e293b;">${to}</strong>) está asociado a una cuenta de Google, también puedes iniciar sesión cómodamente pulsando en el botón <strong>"Continuar con Google"</strong> sin necesidad de recordar contraseñas.</em>
              </div>

              <p style="margin:0; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Si tienes cualquier duda con tus prácticas, contacta con tu autoescuela.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              Notificación generada automáticamente por ${brandName} para la activación de tu cuenta de alumno.<br>
              Por favor, no respondas a este correo.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `${subject}\n\nHola ${studentName},\n\nEl Administrador Central te ha dado de alta en la plataforma de ${brandName}.\n\nDatos de acceso:\n- Email: ${to}\n${temporaryPassword ? `- Contraseña provisional: ${temporaryPassword}\n` : ''
    }\nEnlace de acceso: ${loginUrl}\n\nIMPORTANTE: Te recomendamos cambiar tu contraseña una vez accedas por primera vez desde la sección "Mi perfil".\n\nSi usas cuenta de Google con este mismo email, también puedes acceder pulsando en "Continuar con Google".\n\n¡Bienvenido/a y feliz aprendizaje!\n`;

  return sendEmail({
    to,
    subject,
    html,
    text,
  });
}

export interface BookingEmailNotificationParams {
  bookingId: string;
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  teacherName: string;
  teacherEmail?: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes?: string;
  cancelReason?: string;
  cancelledBy?: string;
  schoolName?: string;
  appUrl?: string;
}

/**
 * Notifies both student and teacher when a class is booked.
 */
export async function sendBookingCreatedEmails(params: BookingEmailNotificationParams): Promise<{
  studentResult?: EmailResult;
  teacherResult?: EmailResult;
}> {
  const {
    studentName,
    studentEmail,
    studentPhone,
    teacherName,
    teacherEmail,
    date,
    startTime,
    endTime,
    durationMinutes,
    notes,
    schoolName,
    appUrl,
  } = params;

  const brandName = schoolName || 'AutoescuelaPro';
  const brandColor = '#19887f';
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const displayDate = match ? `${match[3]}/${match[2]}/${match[1]}` : date;
  const baseUrl = (appUrl || process.env.APP_URL || '').replace(/\/$/, '');
  const loginUrlStudent = baseUrl ? `${baseUrl}?login=true&email=${encodeURIComponent(studentEmail)}` : '#';
  const loginUrlTeacher = baseUrl ? `${baseUrl}?login=true&email=${encodeURIComponent(teacherEmail)}` : '#';

  let studentResult: EmailResult | undefined;
  let teacherResult: EmailResult | undefined;

  // 1. Email to Student
  if (studentEmail && studentEmail.trim() !== '') {
    const studentSubject = `¡Confirmación de Reserva! Clase práctica el ${displayDate} a las ${startTime} - ${brandName}`;
    const studentHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${studentSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 8px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);">
          <tr>
            <td style="background-color: ${brandColor}; padding: 32px 32px; text-align: left;">
              <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 10px;">
                ${brandName}
              </span>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; line-height: 1.3;">
                Tu clase ha sido reservada con éxito
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hola <strong>${studentName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Tu reserva para tu próxima clase práctica de conducir ha quedado confirmada en el sistema.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600; width: 38%;">Fecha:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: ${brandColor}; font-weight: 600;">${displayDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Horario:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: ${brandColor}; font-weight: 600;">${startTime} - ${endTime} (${durationMinutes} min)</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Profesor:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${teacherName}</td>
                </tr>
                ${notes ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Notas:</td>
                  <td style="padding: 6px 0; font-size: 13px; color: #0f172a;">${notes}</td>
                </tr>` : ''}
              </table>

              ${baseUrl ? `
               <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrlStudent}" target="_blank" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 34px; border-radius: 8px;">
                      Gestionar mis clases
                    </a>
                  </td>
                </tr>
              </table>` : ''}

              <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Recuerda llevar tu documentación original a la clase. Si necesitas cancelar, hazlo con la antelación mínima requerida desde tu área de alumno.
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
              Notificación generada automáticamente por ${brandName}.<br>
              Por favor, no respondas a este correo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const studentText = `${studentSubject}\n\nHola ${studentName},\nTu clase ha sido confirmada:\n- Fecha: ${displayDate}\n- Horario: ${startTime} - ${endTime} (${durationMinutes} min)\n- Profesor: ${teacherName}\n${notes ? `- Notas: ${notes}\n` : ''}`;

    studentResult = await sendEmail({
      to: studentEmail,
      subject: studentSubject,
      html: studentHtml,
      text: studentText,
    });
  }

  // 2. Email to Teacher
  if (teacherEmail && teacherEmail.trim() !== '') {
    const teacherSubject = `Nueva clase reservada: ${studentName} - ${displayDate} a las ${startTime}`;
    const teacherHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${teacherSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 8px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);">
          <tr>
            <td style="background-color: ${brandColor}; padding: 32px 32px; text-align: left;">
              <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 10px;">
                ${brandName}
              </span>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; line-height: 1.3;">
                Nueva clase asignada en tu agenda
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hola <strong>${teacherName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Un alumno ha reservado un turno en tu horario disponible. A continuación te mostramos los datos de la práctica:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Fecha:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: ${brandColor}; font-weight: 600;">${displayDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Horario:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: ${brandColor}; font-weight: 600;">${startTime} - ${endTime} (${durationMinutes} min)</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600; width: 38%;">Alumno:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${studentName}</td>
                </tr>
                ${studentPhone ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Teléfono alumno:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${studentPhone}</td>
                </tr>` : ''}
                ${notes ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Observaciones:</td>
                  <td style="padding: 6px 0; font-size: 13px; color: #0f172a;">${notes}</td>
                </tr>` : ''}
              </table>

              ${baseUrl ? `
               <!--<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrlTeacher}" target="_blank" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 34px; border-radius: 8px;">
                      Ver mis clases en la plataforma
                    </a>
                  </td>
                </tr>
              </table>-->` : ''}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
              Notificación generada automáticamente por ${brandName}.<br>
              Por favor, no respondas a este correo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const teacherText = `${teacherSubject}\n\nHola ${teacherName},\nSe ha registrado una nueva clase en tu agenda:\n- Alumno: ${studentName}${studentPhone ? ` (${studentPhone})` : ''}\n- Fecha: ${displayDate}\n- Horario: ${startTime} - ${endTime}\n${notes ? `- Observaciones: ${notes}\n` : ''}`;

    teacherResult = await sendEmail({
      to: teacherEmail,
      subject: teacherSubject,
      html: teacherHtml,
      text: teacherText,
    });
  }

  return { studentResult, teacherResult };
}

/**
 * Notifies both student and teacher when a class is cancelled.
 */
export async function sendBookingCancelledEmails(params: BookingEmailNotificationParams): Promise<{
  studentResult?: EmailResult;
  teacherResult?: EmailResult;
}> {
  const {
    studentName,
    studentEmail,
    teacherName,
    teacherEmail,
    date,
    startTime,
    endTime,
    cancelReason,
    cancelledBy,
    schoolName,
    appUrl,
  } = params;

  const brandName = schoolName || 'AutoescuelaPro';
  const brandColor = '#19887f';
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const displayDate = match ? `${match[3]}/${match[2]}/${match[1]}` : date;
  const baseUrl = (appUrl || process.env.APP_URL || '').replace(/\/$/, '');
  const loginUrlStudent = baseUrl ? `${baseUrl}?login=true&email=${encodeURIComponent(studentEmail)}` : '#';
  const loginUrlTeacher = baseUrl ? `${baseUrl}?login=true&email=${encodeURIComponent(teacherEmail)}` : '#';

  let studentResult: EmailResult | undefined;
  let teacherResult: EmailResult | undefined;

  // 1. Email to Student
  if (studentEmail && studentEmail.trim() !== '') {
    const studentSubject = `Clase cancelada: ${displayDate} a las ${startTime} - ${brandName}`;
    const studentHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${studentSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 8px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);">
          <tr>
            <td style="background-color: #475569; padding: 32px 32px; text-align: left;">
              <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 10px;">
                ${brandName}
              </span>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; line-height: 1.3;">
                Aviso de cancelación de clase
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hola <strong>${studentName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Te confirmamos que la clase práctica programada ha sido <strong>cancelada</strong> y el horario ha quedado liberado.
              </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Fecha:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #e11d48; font-weight: 600;">${displayDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Horario:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #e11d48; font-weight: 600;">${startTime} - ${endTime}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600; width: 38%;">Profesor:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${teacherName}</td>
                </tr>
                ${cancelledBy ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Cancelada por:</td>
                  <td style="padding: 6px 0; font-size: 13px; color: #0f172a;">${cancelledBy}</td>
                </tr>` : ''}
                ${cancelReason ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Motivo:</td>
                  <td style="padding: 6px 0; font-size: 13px; color: #0f172a; font-style: italic;">${cancelReason}</td>
                </tr>` : ''}
              </table>
             
              ${baseUrl ? `
               <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrlStudent}" target="_blank" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 34px; border-radius: 8px;">
                       Reservar otra fecha
                    </a>
                  </td>
                </tr>
              </table>` : ''}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
              ${brandName} • Notificación de cancelación de clase.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const studentText = `${studentSubject}\n\nHola ${studentName},\nTu clase del ${displayDate} a las ${startTime} con ${teacherName} ha sido cancelada.\n${cancelReason ? `Motivo: ${cancelReason}\n` : ''}`;

    studentResult = await sendEmail({
      to: studentEmail,
      subject: studentSubject,
      html: studentHtml,
      text: studentText,
    });
  }

  // 2. Email to Teacher
  if (teacherEmail && teacherEmail.trim() !== '') {
    const teacherSubject = `Clase cancelada en tu agenda: ${studentName} - ${displayDate} a las ${startTime}`;
    const teacherHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${teacherSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 8px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);">
          <tr>
            <td style="background-color: #475569; padding: 32px 32px; text-align: left;">
              <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 10px;">
                ${brandName}
              </span>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; line-height: 1.3;">
                Clase cancelada en tu turno
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hola <strong>${teacherName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Te informamos que la siguiente clase ha sido <strong>cancelada</strong> y dicho hueco vuelve a estar disponible para reservas:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Fecha:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #e11d48; font-weight: 600;">${displayDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Horario:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #e11d48; font-weight: 600;">${startTime} - ${endTime}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600; width: 38%;">Alumno:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${studentName}</td>
                </tr>
                ${cancelledBy ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Cancelada por:</td>
                  <td style="padding: 6px 0; font-size: 13px; color: #0f172a;">${cancelledBy}</td>
                </tr>` : ''}
                ${cancelReason ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">Motivo:</td>
                  <td style="padding: 6px 0; font-size: 13px; color: #0f172a; font-style: italic;">${cancelReason}</td>
                </tr>` : ''}
              </table>

              ${baseUrl ? `
               <!-- <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrlTeacher}" target="_blank" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 34px; border-radius: 8px;">
                      Ver agenda actualizada
                    </a>
                  </td>
                </tr>
              </table>-->` : ''}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
              Notificación generada automáticamente por ${brandName}.<br>
              Por favor, no respondas a este correo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const teacherText = `${teacherSubject}\n\nHola ${teacherName},\nLa clase del ${displayDate} a las ${startTime} con el alumno ${studentName} ha sido cancelada.\n${cancelReason ? `Motivo: ${cancelReason}\n` : ''}`;

    teacherResult = await sendEmail({
      to: teacherEmail,
      subject: teacherSubject,
      html: teacherHtml,
      text: teacherText,
    });
  }

  return { studentResult, teacherResult };
}

/**
 * Generates and sends a secure password recovery email with a reset link
 */
export async function sendPasswordResetEmail({
  to,
  userName,
  resetToken,
  appUrl,
  schoolName,
}: {
  to: string;
  userName?: string;
  resetToken: string;
  appUrl?: string;
  schoolName?: string;
}): Promise<EmailResult> {
  const brandName = schoolName || 'AutoescuelaPro';
  const brandColor = '#3068b5';
  const baseUrl = (appUrl || process.env.APP_URL || '').replace(/\/$/, '');
  const resetUrl = baseUrl ? `${baseUrl}?resetToken=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(to)}` : '#';
  const subject = `🔑 Restablecer contraseña - ${brandName}`;
  const displayName = userName || 'estimado/a usuario/a';

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 8px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: ${brandColor}; padding: 32px 32px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 10px;">
                      ${brandName}
                    </span>
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; line-height: 1.3;">
                      Recuperación de contraseña
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #1e293b;">
                Hola <strong>${displayName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Hemos recibido una solicitud para restablecer la contraseña asociada a tu cuenta en <strong>${brandName}</strong> (<span style="color: #0f172a; font-weight: 600;">${to}</span>).
              </p>

              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Para elegir una nueva contraseña y recuperar tu acceso, haz clic en el siguiente botón:
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 34px; border-radius: 8px;">
                      Restablecer mi contraseña
                    </a>
                    <div style="margin-top: 10px; font-size: 12px; color: #64748b;">
                      Este enlace es de un solo uso y caduca en <strong>1 hora</strong>.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Manual Code / Link Info Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                  ¿Problemas con el botón?
                </p>
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #475569; line-height: 1.5;">
                  Copia y pega la siguiente dirección en tu navegador:
                </p>
                <p style="margin: 0 0 12px 0; font-size: 12px; word-break: break-all; color: ${brandColor};">
                  <a href="${resetUrl}" target="_blank" style="color: ${brandColor}; text-decoration: underline;">${resetUrl}</a>
                </p>
                <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 10px;">
                  <span style="font-size: 11px; color: #64748b; display: block; margin-bottom: 4px;">Código de seguridad:</span>
                  <code style="background-color: #e2e8f0; padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 13px; font-weight: 700; color: #0f172a; display: inline-block;">${resetToken}</code>
                </div>
              </div>

              <!-- Security Advice Box -->
              <div style="background-color: #fffbeb; border: 1px solid #fde896; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #92400e;">
                <strong>¿No has sido tú?</strong> Si no solicitaste este cambio, puedes ignorar este mensaje. Tu cuenta permanecerá protegida y tu contraseña actual no cambiará.
                </p>
              </div>

              <p style="margin:0; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Por motivos de seguridad, nunca compartas este correo ni tu código de recuperación.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              Notificación generada automáticamente por ${brandName} para la recuperación de contraseña.<br>
              Por favor, no respondas a este correo.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `${subject}\n\nHola ${displayName},\n\nHemos recibido una solicitud para restablecer la contraseña asociada a tu cuenta (${to}) en ${brandName}.\n\nPara definir una nueva contraseña, abre el siguiente enlace en tu navegador (válido durante 1 hora):\n${resetUrl}\n\nCódigo de recuperación manual: ${resetToken}\n\nSi no has sido tú quien solicitó este cambio, puedes ignorar este correo tranquilamente; tu contraseña no sufrirá ningún cambio.\n\nAtentamente,\nEquipo de ${brandName}\n`;

  return sendEmail({
    to,
    subject,
    html,
    text,
  });
}