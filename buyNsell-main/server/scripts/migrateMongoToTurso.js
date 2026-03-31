require("dotenv").config();
const mongoose = require("mongoose");
const { getTursoClient } = require("../db/tursoClient");

const toId = (value) => {
  if (!value) return null;
  return value.toString();
};

const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toBoolInt = (value) => (value ? 1 : 0);

const ensureMongoConnection = async () => {
  if (!process.env.ATLAS_KEY) {
    throw new Error("ATLAS_KEY is required to read from MongoDB");
  }

  const connectOptions = {};
  if (process.env.DB_NAME) {
    connectOptions.dbName = process.env.DB_NAME;
  }

  await mongoose.connect(process.env.ATLAS_KEY, connectOptions);
  return mongoose.connection.db;
};

const clearTursoTables = async (client) => {
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
    await client.execute(`DELETE FROM ${table}`);
  }
};

const migrateUsers = async (mongoDb, client) => {
  const users = await mongoDb.collection("users").find({}).toArray();
  for (const user of users) {
    await client.execute({
      sql: `INSERT INTO users (
        id, name, mail, year, address, phone, password, course,
        verified, seller_verified, seller_rating, seller_rating_count,
        verification_expires_at, role, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        toId(user._id),
        user.name || "",
        user.mail || "",
        user.year ?? null,
        user.address || null,
        user.phone != null ? String(user.phone) : null,
        user.password || "",
        user.course || null,
        toBoolInt(user.verified),
        toBoolInt(user.sellerVerified),
        Number(user.sellerRating || 0),
        Number(user.sellerRatingCount || 0),
        toIso(user.verificationExpiresAt),
        user.role || "user",
        toIso(user.createdAt),
        toIso(user.updatedAt),
      ],
    });
  }

  console.log(`Migrated users: ${users.length}`);
};

const migrateProducts = async (mongoDb, client) => {
  const products = await mongoDb.collection("products").find({}).toArray();
  for (const product of products) {
    await client.execute({
      sql: `INSERT INTO products (
        id, seller_id, pname, pprice, pdetail, pdate, pimage, pcat, preg,
        sold, sold_to, sold_price, status,
        approved_at, approved_by, rejected_at, rejected_by,
        expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        toId(product._id),
        toId(product.id),
        product.pname || "",
        Number(product.pprice || 0),
        product.pdetail || null,
        toIso(product.pdate),
        product.pimage || null,
        product.pcat || null,
        toIso(product.preg),
        toBoolInt(product.sold),
        toId(product.soldTo),
        product.soldPrice != null ? Number(product.soldPrice) : null,
        product.status || "pending",
        toIso(product.approvedAt),
        toId(product.approvedBy),
        toIso(product.rejectedAt),
        toId(product.rejectedBy),
        toIso(product.expiresAt),
        toIso(product.createdAt),
        toIso(product.updatedAt),
      ],
    });
  }

  console.log(`Migrated products: ${products.length}`);
};

const migrateBids = async (mongoDb, client) => {
  const bids = await mongoDb.collection("bid").find({}).toArray();
  let bidEntriesCount = 0;

  for (const bid of bids) {
    const bidId = toId(bid._id);
    await client.execute({
      sql: `INSERT INTO bids (id, product_id, seller_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        bidId,
        toId(bid.prodId),
        toId(bid.sellerId),
        toIso(bid.createdAt),
        toIso(bid.updatedAt),
      ],
    });

    const entries = Array.isArray(bid.bids) ? bid.bids : [];
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const entryId = `${bidId}_${i}`;
      await client.execute({
        sql: `INSERT INTO bid_entries (
          id, bid_id, buyer_id, bid_price, bid_time, regno, cancelled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          entryId,
          bidId,
          toId(entry.buyerId),
          entry.bidPrice != null ? Number(entry.bidPrice) : null,
          toIso(entry.bidTime),
          entry.regno || null,
          toBoolInt(entry.cancel),
          toIso(entry.createdAt),
          toIso(entry.updatedAt),
        ],
      });
      bidEntriesCount += 1;
    }
  }

  console.log(`Migrated bids: ${bids.length}`);
  console.log(`Migrated bid entries: ${bidEntriesCount}`);
};

const migrateMessages = async (mongoDb, client) => {
  const messages = await mongoDb.collection("messages").find({}).toArray();
  for (const message of messages) {
    await client.execute({
      sql: `INSERT INTO messages (
        id, product_id, sender_id, receiver_id, message, timestamp, is_read
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        toId(message._id),
        toId(message.productId),
        toId(message.senderId),
        toId(message.receiverId),
        message.message || "",
        toIso(message.timestamp),
        toBoolInt(message.read),
      ],
    });
  }

  console.log(`Migrated messages: ${messages.length}`);
};

const migrateOtps = async (mongoDb, client) => {
  const otps = await mongoDb.collection("otps").find({}).toArray();
  for (const otp of otps) {
    await client.execute({
      sql: `INSERT INTO otps (
        id, user_id, code_hash, expires_at, consumed, purpose, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        toId(otp._id),
        toId(otp.userId),
        otp.codeHash || "",
        toIso(otp.expiresAt),
        toBoolInt(otp.consumed),
        otp.purpose || "login",
        toIso(otp.createdAt),
        toIso(otp.updatedAt),
      ],
    });
  }

  console.log(`Migrated otps: ${otps.length}`);
};

const migrateVerificationTokens = async (mongoDb, client) => {
  const tokens = await mongoDb.collection("token").find({}).toArray();
  for (const token of tokens) {
    const createdAtIso = toIso(token.createdAt);
    const expiresAtIso = token.createdAt
      ? new Date(new Date(token.createdAt).getTime() + 3600 * 1000).toISOString()
      : null;

    await client.execute({
      sql: `INSERT INTO verification_tokens (
        id, user_id, token, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?)`,
      args: [
        toId(token._id),
        toId(token.userId),
        token.token || "",
        createdAtIso,
        expiresAtIso,
      ],
    });
  }

  console.log(`Migrated verification tokens: ${tokens.length}`);
};

const migrateUserTokens = async (mongoDb, client) => {
  const userTokens = await mongoDb.collection("userTokens").find({}).toArray();
  for (const userToken of userTokens) {
    const createdAtIso = toIso(userToken.createdAt);
    const expiresAtIso = userToken.createdAt
      ? new Date(new Date(userToken.createdAt).getTime() + 30 * 86400 * 1000).toISOString()
      : null;

    await client.execute({
      sql: `INSERT INTO user_tokens (
        id, user_id, token, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?)`,
      args: [
        toId(userToken._id),
        toId(userToken.userId),
        userToken.token || "",
        createdAtIso,
        expiresAtIso,
      ],
    });
  }

  console.log(`Migrated user tokens: ${userTokens.length}`);
};

const run = async () => {
  const mongoDb = await ensureMongoConnection();
  const tursoClient = getTursoClient();

  try {
    await clearTursoTables(tursoClient);
    await migrateUsers(mongoDb, tursoClient);
    await migrateProducts(mongoDb, tursoClient);
    await migrateBids(mongoDb, tursoClient);
    await migrateMessages(mongoDb, tursoClient);
    await migrateOtps(mongoDb, tursoClient);
    await migrateVerificationTokens(mongoDb, tursoClient);
    await migrateUserTokens(mongoDb, tursoClient);

    console.log("MongoDB to Turso migration completed successfully.");
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
