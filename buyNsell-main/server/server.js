const buyNsellRouter = require("./routes/buyNsell");
const Product = require("./models/products");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/\/$/, ""))
  .filter(Boolean);

const originMatchesRule = (origin, rule) => {
  const normalizedOrigin = origin.replace(/\/$/, "");
  const normalizedRule = rule.replace(/\/$/, "");

  if (normalizedRule === "*") return true;
  if (!normalizedRule.includes("*")) return normalizedOrigin === normalizedRule;

  const escapedRule = normalizedRule
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const wildcardRegex = new RegExp(`^${escapedRule}$`);
  return wildcardRegex.test(normalizedOrigin);
};

const isAllowedOrigin = (origin) => {
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.some((rule) => originMatchesRule(origin, rule));
};

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      console.log(`Blocked by CORS: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
  })
);

mongoose.set("strictQuery", false);
app.use(express.urlencoded({ extended: false }));

const ensureIndexesOnStartup = async () => {
  // Keep sort-critical indexes present in production even if autoIndex is disabled.
  if (process.env.ENSURE_INDEXES_ON_STARTUP === "false") {
    return;
  }

  try {
    await Product.createIndexes();
    console.log("Product indexes ensured");
  } catch (error) {
    console.log("Failed to ensure product indexes:", error?.message || error);
  }
};

if (process.env.ATLAS_KEY) {
  const connectOptions = {};
  if (process.env.DB_NAME) {
    connectOptions.dbName = process.env.DB_NAME;
  }

  mongoose
    .connect(`${process.env.ATLAS_KEY}`, connectOptions)
    .then(async () => {
      console.log(`connected to db: ${mongoose.connection.name}`);
      await ensureIndexesOnStartup();
    })
    .catch((err) => console.log("DB connection error:", err));
} else {
  console.log("ATLAS_KEY not set — skipping MongoDB connection. Set ATLAS_KEY in .env to connect to your database.");
}

const PORT = process.env.PORT || 5000;

app.use("/api", buyNsellRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
