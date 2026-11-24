import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

function getMissingSmtpConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.SMTP_HOST) missing.push('SMTP_HOST');
  if (!process.env.SMTP_USER) missing.push('SMTP_USER');
  if (!process.env.SMTP_PASS && !process.env.SMTP_PASSWORD) missing.push('SMTP_PASS (or SMTP_PASSWORD)');
  if (!process.env.SMTP_FROM && !process.env.SMTP_FROM_EMAIL && !process.env.SMTP_USER) {
    missing.push('SMTP_FROM (or SMTP_FROM_EMAIL)');
  }
  return missing;
}

function createSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: user!,
      pass: pass!,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
}

/**
 * GET: Safe verification of SMTP configuration & connectivity without modifying any application state.
 */
export async function GET(request: Request) {
  const missing = getMissingSmtpConfig();
  if (missing.length > 0) {
    return NextResponse.json({
      success: false,
      configured: false,
      connected: false,
      missing,
      error: `SMTP configuration is incomplete. Missing environment variable(s): ${missing.join(', ')}.`
    });
  }

  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER!;

  try {
    const transporter = createSmtpTransporter();
    // nodemailer verify() verifies connection & credentials without sending mail
    await transporter.verify();

    return NextResponse.json({
      success: true,
      configured: true,
      connected: true,
      host,
      port,
      user: user.replace(/(?<=^.{2}).*(?=@)/, '***'),
      message: 'SMTP connection and authentication verified successfully.'
    });
  } catch (err: any) {
    console.error('[SMTP Verification] Error verifying connection:', err);
    let errorMessage = err?.message || 'SMTP connection verification failed.';
    if (err?.code === 'EAUTH') {
      errorMessage = 'SMTP authentication failed. Please check SMTP_USER and SMTP_PASS/SMTP_PASSWORD credentials.';
    } else if (err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT' || err?.code === 'ENOTFOUND') {
      errorMessage = `Cannot reach SMTP host at ${host}:${port} (${err?.code}).`;
    }

    return NextResponse.json({
      success: false,
      configured: true,
      connected: false,
      code: err?.code,
      error: errorMessage
    }, { status: 500 });
  }
}

/**
 * POST: Sends emails via configured SMTP server or executes a safe test transmission.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, cc, subject, html, attachments, action } = body;

    const missingConfig = getMissingSmtpConfig();
    if (missingConfig.length > 0) {
      console.error('[SMTP] Incomplete SMTP configuration: Missing', missingConfig);
      return NextResponse.json(
        { 
          success: false, 
          error: `SMTP configuration is incomplete. Missing environment variable(s): ${missingConfig.join(', ')}.`,
          missing: missingConfig 
        },
        { status: 500 }
      );
    }

    // Helper to sanitize and deduplicate emails
    const normalizeEmails = (input: any): string[] => {
      if (!input) return [];
      const arr = Array.isArray(input) ? input : String(input).split(/[,;]/);
      return arr
        .map((e: any) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
        .filter((e: string) => e.length > 0 && e.includes('@'));
    };

    // Safe Test Mode: Sends a test email to verify end-to-end provider acceptance
    if (action === 'test-email') {
      const testRecipient = normalizeEmails(to)[0] || process.env.TASK_HEAD_EMAIL || process.env.SMTP_USER;
      if (!testRecipient) {
        return NextResponse.json(
          { success: false, error: 'A test recipient email address is required.' },
          { status: 400 }
        );
      }

      const user = process.env.SMTP_USER!;
      const fromName = process.env.SMTP_FROM_NAME || 'Apex Tasks';
      const from = process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || `"${fromName}" <${user}>`;

      const transporter = createSmtpTransporter();
      const info = await transporter.sendMail({
        from,
        to: testRecipient,
        subject: 'Apex Tasks – SMTP Configuration Test',
        html: `
          <div style="font-family: sans-serif; padding: 20px; background-color: #18181b; color: #f4f4f5; border-radius: 8px;">
            <h2 style="color: #a78bfa; margin-top: 0;">SMTP Test Successful</h2>
            <p>Your Apex Tasks SMTP email delivery configuration is operational.</p>
            <p style="font-size: 12px; color: #a1a1aa;">Sent at: ${new Date().toISOString()}</p>
          </div>
        `
      });

      return NextResponse.json({
        success: true,
        messageId: info.messageId,
        testRecipient,
        message: 'Test email successfully accepted by the SMTP server.'
      });
    }

    if (!to || !subject || !html) {
      return NextResponse.json(
        { success: false, error: 'Missing required email fields (to, subject, html).' },
        { status: 400 }
      );
    }

    const headEmail = (process.env.TASK_HEAD_EMAIL || 'rr@i2space.com').trim().toLowerCase();

    const toList = Array.from(new Set(normalizeEmails(to)));
    if (toList.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid recipient email provided in "to" field.' },
        { status: 400 }
      );
    }
    const toSet = new Set(toList);

    // CC candidates: incoming cc + head email
    const rawCcList = normalizeEmails(cc);
    if (headEmail && headEmail.includes('@')) {
      rawCcList.push(headEmail);
    }

    // Filter CC to omit duplicates and any email already in TO
    const ccSet = new Set<string>();
    rawCcList.forEach((email) => {
      if (!toSet.has(email)) {
        ccSet.add(email);
      }
    });
    const ccList = Array.from(ccSet);

    const user = process.env.SMTP_USER!;
    const fromName = process.env.SMTP_FROM_NAME || 'Apex Tasks';
    const from = process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || `"${fromName}" <${user}>`;

    const transporter = createSmtpTransporter();

    const mailOptions: nodemailer.SendMailOptions = {
      from,
      to: toList,
      subject,
      html,
    };

    if (ccList.length > 0) {
      mailOptions.cc = ccList;
    }

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content,
        encoding: 'base64',
      }));
    }

    const info = await transporter.sendMail(mailOptions);
    console.log('[SMTP] Email sent successfully. Message ID:', info.messageId, 'TO:', toList, 'CC:', ccList);

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    if (error?.code === 'EAUTH') {
      console.error('[SMTP] Authentication failed with the SMTP server.');
      return NextResponse.json(
        { success: false, error: 'SMTP authentication failed. Please check SMTP_USER and SMTP_PASS/SMTP_PASSWORD in .env.local.' },
        { status: 500 }
      );
    }
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
      console.error('[SMTP] Connection failed:', error?.code);
      return NextResponse.json(
        { success: false, error: `Unable to connect to SMTP server (${error?.code || 'Network Error'}).` },
        { status: 500 }
      );
    }
    console.error('[SMTP] Error sending email:', error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to send email via SMTP.' },
      { status: 500 }
    );
  }
}

