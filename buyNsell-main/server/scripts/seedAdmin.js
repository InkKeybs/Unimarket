require("dotenv").config();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { getTursoClient } = require("../db/tursoClient");
const { toSqliteDatetime } = require("../db/sqlHelpers");

async function run() {
  const client = getTursoClient();

  const email = process.env.SEED_ADMIN_EMAIL || "admin@rtu.edu.ph";
  const password = process.env.SEED_ADMIN_PASSWORD || "AdminPass123!";
  const name = process.env.SEED_ADMIN_NAME || "Marketplace Admin";
  const address = process.env.SEED_ADMIN_ADDRESS || "RTU Campus";
  const phone = Number(process.env.SEED_ADMIN_PHONE) || 9000000000;
  const course = process.env.SEED_ADMIN_COURSE || "Administration";

  try {
    const existingResult = await client.execute({
      sql: "SELECT id FROM users WHERE LOWER(mail) = LOWER(?) LIMIT 1",
      args: [email],
    });

    if (existingResult.rows.length > 0) {
      await client.execute({
        sql: "UPDATE users SET role = 'admin', verified = 1, updated_at = ? WHERE id = ?",
        args: [toSqliteDatetime(new Date()), existingResult.rows[0].id],
      });
      console.log(`Existing user ${email} promoted to admin.`);
      process.exit(0);
    }

    const saltRounds = Number(process.env.SALT) || 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashPassword = await bcrypt.hash(password, salt);

    const now = toSqliteDatetime(new Date());
    await client.execute({
      sql: `INSERT INTO users
            (id, name, mail, address, phone, password, course, verified, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'admin', ?, ?)`,
      args: [
        crypto.randomUUID(),
        name,
        email,
        address,
        String(phone),
        hashPassword,
        course,
        now,
        now,
      ],
    });

    console.log("Admin user created successfully:");
    console.log(`  email: ${email}`);
    console.log(`  password: ${password}`);
    process.exit(0);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  }
}

run();