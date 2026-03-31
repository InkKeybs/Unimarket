require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getTursoClient } = require('../db/tursoClient');
const { toSqliteDatetime } = require('../db/sqlHelpers');

async function run() {
  const client = getTursoClient();

  const email = process.env.SEED_USER_EMAIL || 'testuser@example.com';
  const password = process.env.SEED_USER_PASSWORD || 'TestPass123!';
  const name = process.env.SEED_USER_NAME || 'Test User';
  const year = Number(process.env.SEED_USER_YEAR) || 3;
  const address = process.env.SEED_USER_ADDRESS || '123 Campus Ave';
  const phone = Number(process.env.SEED_USER_PHONE) || 1234567890;
  const course = process.env.SEED_USER_COURSE || 'Computer Science';

  try {
    const existing = await client.execute({
      sql: 'SELECT id FROM users WHERE LOWER(mail) = LOWER(?) LIMIT 1',
      args: [email],
    });
    if (existing.rows.length > 0) {
      console.log(`User with email ${email} already exists. Exiting.`);
      process.exit(0);
    }

    const saltRounds = Number(process.env.SALT) || 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashPassword = await bcrypt.hash(password, salt);

    const now = toSqliteDatetime(new Date());
    await client.execute({
      sql: `INSERT INTO users
            (id, name, mail, year, address, phone, password, course, verified, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'user', ?, ?)`,
      args: [
        crypto.randomUUID(),
        name,
        email,
        year,
        address,
        String(phone),
        hashPassword,
        course,
        now,
        now,
      ],
    });

    console.log('Seed user created successfully:');
    console.log(`  email: ${email}`);
    console.log(`  password: ${password}`);
    process.exit(0);
  } catch (err) {
    console.error('Error creating seed user:', err);
    process.exit(1);
  }
}

run();
