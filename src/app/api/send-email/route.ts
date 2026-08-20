import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { to, cc, subject, html, attachments } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json(
        { success: false, error: 'Missing required email fields (to, subject, html).' },
        { status: 400 }
      );
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || (user ? `"Team Task Portal" <${user}>` : undefined);

    if (!host || !user || !pass || !from) {
      console.error('[SMTP] Incomplete SMTP configuration: Missing required environment variables.');
      return NextResponse.json(
        { success: false, error: 'SMTP configuration is incomplete.' },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // port 587 uses STARTTLS
      auth: {
        user,
        pass,
      },
    });

    const mailOptions: nodemailer.SendMailOptions = {
      from,
      to,
      subject,
      html,
    };

    if (cc) {
      mailOptions.cc = cc;
    }

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content,
        encoding: 'base64',
      }));
    }

    const info = await transporter.sendMail(mailOptions);
    console.log('[SMTP] Email sent successfully. Message ID:', info.messageId);

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    if (error?.code === 'EAUTH') {
      console.error('[SMTP] Authentication failed with the SMTP server.');
      return NextResponse.json(
        { success: false, error: 'SMTP authentication failed. Please check credentials.' },
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

