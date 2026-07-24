import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { to, cc, subject, html, attachments } = await request.json();

    // SMTP Credentials - Change these placeholders with actual values later
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.example.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false, // true for port 465, false for other ports (587, 25)
      auth: {
        user: process.env.SMTP_USER || "demo_user@example.com",
        pass: process.env.SMTP_PASS || "demo_password_placeholder",
      },
    });

    const mailOptions: any = {
      from: process.env.SMTP_FROM || '"Team Task Portal" <noreply@example.com>',
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
    console.log("[SMTP] Email sent successfully:", info.messageId);

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("[SMTP] Error sending email:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send email via SMTP" },
      { status: 500 }
    );
  }
}
