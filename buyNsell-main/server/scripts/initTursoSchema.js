require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { getTursoClient } = require("../db/tursoClient");

const run = async () => {
  const client = getTursoClient();
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  const statements = schemaSql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.execute(statement);
  }

  console.log("Turso schema initialized successfully.");
};

run().catch((error) => {
  console.error("Failed to initialize Turso schema:", error);
  process.exit(1);
});
