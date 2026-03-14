const nodemailer = require("nodemailer");

// Send via Brevo REST API
const sendViaBrevo = async (email, subject, text) => {
  const senderEmail = process.env.USER;
  const senderName = process.env.BREVO_SENDER_NAME || "Unimarket";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email }],
      subject,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Brevo API error: ${response.status} ${responseText}`);
  }

  console.log("Email sent via Brevo API!");
};

// Build a nodemailer transporter from env vars
// Backup uses BACKUP_SMTP_* prefix; primary SMTP uses SMTP_* prefix
const buildTransporter = (prefix = "SMTP") => {
  const host = process.env[`${prefix}_HOST`];
  const service = process.env[`${prefix}_SERVICE`] || (prefix === "SMTP" ? process.env.SERVICE : null);
  const user = process.env[`${prefix}_USER`] || process.env.USER;
  const pass = process.env[`${prefix}_PASS`] || process.env.PASS;

  const base = {
    auth: { user, pass },
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
  };

  if (host) {
    return nodemailer.createTransport({
      ...base,
      host,
      port: Number(process.env[`${prefix}_PORT`] || 587),
      secure: String(process.env[`${prefix}_SECURE`] || "false") === "true",
    });
  }

  if (service) {
    return nodemailer.createTransport({ ...base, service });
  }

  return null;
};

const sendViaSmtp = async (email, subject, text, prefix = "SMTP") => {
  const transporter = buildTransporter(prefix);
  if (!transporter) throw new Error(`No SMTP config found for prefix ${prefix}`);

  const fromAddr =
    process.env[`${prefix}_USER`] || process.env.USER;

  await transporter.sendMail({ from: fromAddr, to: email, subject, text });
  console.log(`Email sent via ${prefix} SMTP!`);
};

module.exports = async (email, subject, text) => {
  // 1. Try Brevo if configured
  if (process.env.BREVO_API_KEY) {
    try {
      await sendViaBrevo(email, subject, text);
      return;
    } catch (brevoErr) {
      console.warn("Brevo failed, trying backup:", brevoErr.message);
    }
  }

  // 2. Try backup SMTP (BACKUP_SMTP_HOST or BACKUP_SMTP_SERVICE) if configured
  const hasBackupSmtp =
    process.env.BACKUP_SMTP_HOST || process.env.BACKUP_SMTP_SERVICE;

  if (hasBackupSmtp) {
    try {
      await sendViaSmtp(email, subject, text, "BACKUP_SMTP");
      return;
    } catch (backupErr) {
      console.warn("Backup SMTP failed, trying primary SMTP:", backupErr.message);
    }
  }

  // 3. Fall back to primary SMTP (SMTP_HOST or SERVICE)
  try {
    await sendViaSmtp(email, subject, text, "SMTP");
  } catch (error) {
    console.log("All email providers failed!");
    console.log(error);
    throw error;
  }
};
