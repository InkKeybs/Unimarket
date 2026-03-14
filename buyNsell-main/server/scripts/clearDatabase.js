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
    const connectOptions = {};
    if (process.env.DB_NAME) {
      connectOptions.dbName = process.env.DB_NAME;
    }

    await mongoose.connect(process.env.ATLAS_KEY, connectOptions);
    console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);

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
      const beforeCount = await collection.model.countDocuments({});
      const result = await collection.model.deleteMany({});
      const afterCount = await collection.model.countDocuments({});
      console.log(
        `Cleared ${collection.name}: ${result.deletedCount} removed (before: ${beforeCount}, after: ${afterCount})`
      );
    }

    console.log("Database cleared successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error clearing database:", error);
    process.exit(1);
  }
}

run();