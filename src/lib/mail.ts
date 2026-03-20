import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<void> {
  await transporter.sendMail({
    from: `"MIT Events" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Your MIT Events verification code",
    text: `Your verification code is: ${code}\n\nThis code expires in 5 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111;">MIT Events — Verify your email</h2>
        <p style="color: #555;">Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center; padding: 16px; background: #f3f4f6; border-radius: 8px; margin: 16px 0;">
          ${code}
        </div>
        <p style="color: #999; font-size: 13px;">This code expires in 5 minutes.</p>
      </div>
    `,
  });
}
