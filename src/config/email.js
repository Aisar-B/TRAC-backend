import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../../.env');

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: envPath });
  console.log('🔍 Looking for .env at:', envPath);
}

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@localhost';
const fromName = process.env.RESEND_FROM_NAME || 'TRAC Request';
export const studentAppUrl = process.env.STUDENT_APP_URL || '#';
export const adminAppUrl = process.env.ADMIN_APP_URL || '#';
const resolveStudentLogoUrl = () => {
  try {
    const configuredUrl = process.env.TRAC_LOGO_URL?.trim();
    const baseUrl = process.env.STUDENT_APP_URL?.trim();
    const candidate = configuredUrl || (baseUrl ? new URL('/TracLogo.png', baseUrl).toString() : '');
    if (!candidate) return '';

    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.username || url.password || url.hostname.endsWith('.example')) return '';
    return url.toString();
  } catch {
    return '';
  }
};
export const studentLogoUrl = resolveStudentLogoUrl();
const resend = resendApiKey ? new Resend(resendApiKey) : null;

console.log('📧 Resend config check:');
console.log('- RESEND_API_KEY:', resendApiKey ? '✅ Set' : '❌ Missing');
console.log('- RESEND_FROM_EMAIL:', fromEmail && fromEmail !== 'noreply@localhost' ? '✅ Set' : '⚠️ Using fallback');
console.log('- RESEND_FROM_NAME:', fromName);

export const verifyResendConfig = async () => {
  if (!resendApiKey || !fromEmail || fromEmail === 'noreply@localhost') {
    return {
      ok: false,
      message: 'Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in your environment.'
    };
  }

  try {
    const result = await resend.emails.list({ limit: 1 });
    return { ok: true, message: 'Resend is configured', data: result.data || result };
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'Failed to verify Resend configuration.'
    };
  }
};

export const sendEmail = async (
  recipientEmail,
  subject,
  html,
  text = ''
) => {
  try {
    if (!resend || !resendApiKey || !fromEmail || fromEmail === 'noreply@localhost') {
      throw new Error('Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in your environment.');
    }

    const recipients = Array.isArray(recipientEmail)
      ? recipientEmail
      : [recipientEmail];

    console.log('📧 Attempting to send email via Resend...');
    console.log('➡️ Recipient(s):', recipients);
    console.log('➡️ Subject:', subject);

    const response = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: recipients,
      subject,
      html,
      text: text || 'Please view this email in HTML format.',
    });

    if (response.error) {
      console.error('❌ Resend API returned an error:', response.error);
      return {
        success: false,
        error: response.error.message || 'Unknown Resend error',
        response: response.error
      };
    }

    console.log('✅ Resend email sent successfully');
    console.log('Message ID:', response.data?.id || null);

    return {
      success: true,
      messageId: response.data?.id || null,
      response: response.data || response
    };
  } catch (error) {
    console.error('EMAIL ERROR START');
    console.error(error);
    console.error('EMAIL ERROR END');

    return {
      success: false,
      error: error.message,
    };
  }
};