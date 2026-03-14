require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/user");

async function run() {
  if (!process.env.ATLAS_KEY) {
    console.error("Please set ATLAS_KEY in your .env to connect to MongoDB");
    process.exit(1);
  }

  await mongoose.connect(process.env.ATLAS_KEY);
  console.log("Connected to MongoDB");

  const email = process.env.SEED_ADMIN_EMAIL || "admin@rtu.edu.ph";
  const password = process.env.SEED_ADMIN_PASSWORD || "AdminPass123!";
  const name = process.env.SEED_ADMIN_NAME || "Marketplace Admin";
  const year = Number(process.env.SEED_ADMIN_YEAR) || 1;
  const address = process.env.SEED_ADMIN_ADDRESS || "RTU Campus";
  const phone = Number(process.env.SEED_ADMIN_PHONE) || 9000000000;
  const course = process.env.SEED_ADMIN_COURSE || "Administration";

  try {
    const existing = await User.findOne({ mail: email });
    if (existing) {
      existing.role = "admin";
      existing.verified = true;
      await existing.save();
      console.log(`Existing user ${email} promoted to admin.`);
      process.exit(0);
    }

    const saltRounds = Number(process.env.SALT) || 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashPassword = await bcrypt.hash(password, salt);

    const adminUser = new User({
      name,
      mail: email,
      year,
      address,
      phone,
      password: hashPassword,
      course,
      verified: true,
      role: "admin",
    });

    await adminUser.save();
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