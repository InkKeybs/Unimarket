require("dotenv").config();
const { getTursoClient } = require("../db/tursoClient");

async function run() {
  try {
    const client = getTursoClient();

    const tables = [
      "bid_entries",
      "bids",
      "messages",
      "otps",
      "verification_tokens",
      "user_tokens",
      "products",
      "users",
    ];

    for (const table of tables) {
      const before = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
      await client.execute(`DELETE FROM ${table}`);
      const after = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);

      const beforeCount = Number(before.rows?.[0]?.count || 0);
      const afterCount = Number(after.rows?.[0]?.count || 0);
      console.log(
        `Cleared ${table}: ${beforeCount - afterCount} removed (before: ${beforeCount}, after: ${afterCount})`
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