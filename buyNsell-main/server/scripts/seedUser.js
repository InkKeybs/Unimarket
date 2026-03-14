require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/user');

async function run() {
  if (!process.env.ATLAS_KEY) {
    console.error('Please set ATLAS_KEY in your .env to connect to MongoDB');
    process.exit(1);
  }

  const connectOptions = {};
  if (process.env.DB_NAME) {
    connectOptions.dbName = process.env.DB_NAME;
  }

  const atlas = process.env.ATLAS_KEY;
  await mongoose.connect(atlas, connectOptions);
  console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);

  const email = process.env.SEED_USER_EMAIL || 'testuser@example.com';
  const password = process.env.SEED_USER_PASSWORD || 'TestPass123!';
  const name = process.env.SEED_USER_NAME || 'Test User';
  const year = Number(process.env.SEED_USER_YEAR) || 3;
  const address = process.env.SEED_USER_ADDRESS || '123 Campus Ave';
  const phone = Number(process.env.SEED_USER_PHONE) || 1234567890;
  const course = process.env.SEED_USER_COURSE || 'Computer Science';

  try {
    const existing = await User.findOne({ mail: email });
    if (existing) {
      console.log(`User with email ${email} already exists. Exiting.`);
      process.exit(0);
    }

    const saltRounds = Number(process.env.SALT) || 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      mail: email,
      year,
      address,
      phone,
      password: hashPassword,
      course,
      verified: true,
      role: 'user',
    });

    await user.save();
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
