const nodemailer = require("nodemailer");

module.exports = async (email, subject, text) => {
  try {
    if (process.env.BREVO_API_KEY) {
      const senderEmail = process.env.USER;
      const senderName = process.env.BREVO_SENDER_NAME || "Unimarket";

      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: {
            email: senderEmail,
            name: senderName,
          },
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
      return;
    }

    const transportConfig = process.env.SMTP_HOST
      ? {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: String(process.env.SMTP_SECURE || "false") === "true",
          auth: {
            user: process.env.USER,
            pass: process.env.PASS,
          },
          connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
          greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
          socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
        }
      : {
          service: process.env.SERVICE,
          auth: {
            user: process.env.USER,
            pass: process.env.PASS,
          },
          connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
          greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
          socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
        };

    const transporter = nodemailer.createTransport(transportConfig);

    await transporter.sendMail({
      from: process.env.USER,
      to: email,
      subject: subject,
      text: text,
    });
    console.log("Email sent!");
  } catch (error) {
    console.log("Email not sent!");
    console.log(error);
    throw error;
  }
};
