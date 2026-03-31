const buyNsellRouter = require("./routes/buyNsell");
const bodyParser = require("body-parser");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { getTursoClient } = require("./db/tursoClient");
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

app.use(express.urlencoded({ extended: false }));

const ensureSchemaOnStartup = async () => {
  if (process.env.ENSURE_SCHEMA_ON_STARTUP === "false") {
    return;
  }

  try {
    const schemaPath = path.join(__dirname, "db", "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    const statements = schemaSql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    const client = getTursoClient();
    for (const statement of statements) {
      await client.execute(statement);
    }

    try {
      await client.execute("ALTER TABLE products ADD COLUMN pcondition TEXT");
    } catch (migrationError) {
      const message = String(migrationError?.message || migrationError || "").toLowerCase();
      if (!message.includes("duplicate column name")) {
        throw migrationError;
      }
    }

    console.log("Turso schema ensured on startup");
  } catch (error) {
    console.log("Failed to ensure Turso schema:", error?.message || error);
  }
};

const verifyTursoConnection = async () => {
  try {
    const client = getTursoClient();
    await client.execute("SELECT 1");
    console.log("Connected to Turso/SQLite database");
  } catch (error) {
    console.log("Database connection error:", error?.message || error);
  }
};

verifyTursoConnection();
ensureSchemaOnStartup();

const PORT = process.env.PORT || 5000;

app.use("/api", buyNsellRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
