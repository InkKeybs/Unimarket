const nodemailer = require("nodemailer");

module.exports = async (email, subject, text) => {
  try {
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
