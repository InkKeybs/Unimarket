require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../models/user");
const Token = require("../models/token");
const Otp = require("../models/otp");
const Product = require("../models/products");
const Bid = require("../models/bid");
const Message = require("../models/message");
const UserToken = require("../models/userToken");

async function run() {
  if (!process.env.ATLAS_KEY) {
    console.error("Please set ATLAS_KEY in your .env to connect to MongoDB");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.ATLAS_KEY);
    console.log("Connected to MongoDB");

    const collections = [
      { name: "users", model: User },
      { name: "tokens", model: Token },
      { name: "otps", model: Otp },
      { name: "products", model: Product },
      { name: "bids", model: Bid },
      { name: "messages", model: Message },
      { name: "userTokens", model: UserToken },
    ];

    for (const collection of collections) {
      const result = await collection.model.deleteMany({});
      console.log(`Cleared ${collection.name}: ${result.deletedCount} document(s) removed`);
    }

    console.log("Database cleared successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error clearing database:", error);
    process.exit(1);
  }
}

run();