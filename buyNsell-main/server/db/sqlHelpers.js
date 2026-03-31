const { getTursoClient } = require("./tursoClient");
const crypto = require("crypto");

// Helper: Convert UTC string to SQLite format
const toSqliteDatetime = (date) => {
  if (!date) return null;
  return typeof date === 'string' ? date : new Date(date).toISOString();
};

// Helper: Convert SQLite datetime back to JS Date
const fromSqliteDatetime = (dateStr) => {
  if (!dateStr) return null;
  return new Date(dateStr);
};

// Helper: Convert boolean to SQLite integer
const toBoolInt = (val) => val ? 1 : 0;

// Helper: Convert SQLite integer to boolean
const fromBoolInt = (val) => val === 1;

// User queries
const getUserById = async (id) => {
  const client = getTursoClient();
  try {
    const result = await client.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id]
    });
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.log("Error getting user by ID:", error);
    return null;
  }
};

const getUserByEmail = async (email) => {
  const client = getTursoClient();
  try {
    const result = await client.execute({
      sql: "SELECT * FROM users WHERE LOWER(mail) = LOWER(?)",
      args: [email]
    });
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.log("Error getting user by email:", error);
    return null;
  }
};

const createUser = async (userData) => {
  const client = getTursoClient();
  try {
    const id = userData.id || crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO users 
            (id, name, mail, year, address, phone, password, course, verified, 
             verification_expires_at, seller_verified, seller_rating, seller_rating_count, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        userData.name || '',
        userData.mail || '',
        userData.year || null,
        userData.address || null,
        userData.phone || null,
        userData.password || '',
        userData.course || null,
        toBoolInt(userData.verified || false),
        toSqliteDatetime(userData.verificationExpiresAt),
        toBoolInt(userData.sellerVerified || false),
        userData.sellerRating || 0,
        userData.sellerRatingCount || 0,
        userData.role || 'user',
        toSqliteDatetime(new Date()),
        toSqliteDatetime(new Date())
      ]
    });
    return { id, ...userData };
  } catch (error) {
    console.log("Error creating user:", error);
    throw error;
  }
};

const updateUser = async (id, updates) => {
  const client = getTursoClient();
  try {
    const setClauses = [];
    const args = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'verified' || key === 'sellerVerified') {
        setClauses.push(`${key} = ?`);
        args.push(toBoolInt(value));
      } else if (key === 'verificationExpiresAt' || key === 'verification_expires_at') {
        setClauses.push(`verification_expires_at = ?`);
        args.push(toSqliteDatetime(value));
      } else {
        setClauses.push(`${key} = ?`);
        args.push(value);
      }
    }

    setClauses.push("updated_at = ?");
    args.push(toSqliteDatetime(new Date()));
    args.push(id);

    if (setClauses.length > 1) {  // At least updated_at + one other field
      await client.execute({
        sql: `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
        args
      });
    }
    return true;
  } catch (error) {
    console.log("Error updating user:", error);
    throw error;
  }
};

const deleteUser = async (id) => {
  const client = getTursoClient();
  try {
    await client.execute({
      sql: "DELETE FROM users WHERE id = ?",
      args: [id]
    });
    return true;
  } catch (error) {
    console.log("Error deleting user:", error);
    throw error;
  }
};

// OTP queries
const createOtp = async (userId, codeHash, expiresAt, purpose = 'login') => {
  const client = getTursoClient();
  try {
    const id = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO otps (id, user_id, code_hash, expires_at, purpose, consumed, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [id, userId, codeHash, toSqliteDatetime(expiresAt), purpose, toSqliteDatetime(new Date()), toSqliteDatetime(new Date())]
    });
    return id;
  } catch (error) {
    console.log("Error creating OTP:", error);
    throw error;
  }
};

const getLatestOtpForUser = async (userId, purpose = 'login') => {
  const client = getTursoClient();
  try {
    const result = await client.execute({
      sql: `SELECT * FROM otps 
            WHERE user_id = ? AND purpose = ? AND consumed = 0
            ORDER BY created_at DESC LIMIT 1`,
      args: [userId, purpose]
    });
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.log("Error getting latest OTP:", error);
    return null;
  }
};

const markOtpAsConsumed = async (otpId) => {
  const client = getTursoClient();
  try {
    await client.execute({
      sql: "UPDATE otps SET consumed = 1 WHERE id = ?",
      args: [otpId]
    });
    return true;
  } catch (error) {
    console.log("Error marking OTP consumed:", error);
    throw error;
  }
};

const deleteOtpsForUser = async (userId, purpose) => {
  const client = getTursoClient();
  try {
    await client.execute({
      sql: "DELETE FROM otps WHERE user_id = ? AND purpose = ?",
      args: [userId, purpose]
    });
    return true;
  } catch (error) {
    console.log("Error deleting OTPs:", error);
    throw error;
  }
};

// Product queries
const getApprovedProducts = async () => {
  const client = getTursoClient();
  try {
    const now = new Date().toISOString();
    const result = await client.execute({
      sql: `SELECT * FROM products 
            WHERE sold = 0 
            AND (status = 'approved' OR status IS NULL OR status = '')
            AND (expires_at IS NULL OR expires_at > ?)
            ORDER BY created_at DESC`,
      args: [now]
    });
    return result.rows || [];
  } catch (error) {
    console.log("Error getting approved products:", error);
    return [];
  }
};

const searchProducts = async (searchTerms) => {
  const client = getTursoClient();
  try {
    const now = new Date().toISOString();
    
    if (!searchTerms || searchTerms.trim() === '') {
      return getApprovedProducts();
    }

    // Split search terms and build LIKE patterns
    const tokens = searchTerms.split(/\s+/).filter(Boolean);
    const whereClauses = tokens.map(() => `(pname LIKE ? OR pcat LIKE ? OR pdetail LIKE ?)`).join(' AND ');
    const args = [];
    tokens.forEach(token => {
      const pattern = `%${token}%`;
      args.push(pattern, pattern, pattern);
    });
    args.push(now);

    const result = await client.execute({
      sql: `SELECT * FROM products 
            WHERE sold = 0
            AND (status = 'approved' OR status IS NULL OR status = '')
            AND (expires_at IS NULL OR expires_at > ?)
            AND (${whereClauses})
            ORDER BY created_at DESC`,
      args: [now, ...args]
    });
    return result.rows || [];
  } catch (error) {
    console.log("Error searching products:", error);
    return [];
  }
};

const getProductById = async (productId) => {
  const client = getTursoClient();
  try {
    const result = await client.execute({
      sql: "SELECT * FROM products WHERE id = ?",
      args: [productId]
    });
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.log("Error getting product by ID:", error);
    return null;
  }
};

const createProduct = async (productData) => {
  const client = getTursoClient();
  try {
    const id = productData.id || crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO products 
            (id, seller_id, pname, pprice, pdetail, pdate, pimage, pcat, preg, 
             sold, status, expires_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        productData.seller_id || productData.id,
        productData.pname || '',
        productData.pprice || 0,
        productData.pdetail || '',
        productData.pdate || toSqliteDatetime(new Date()),
        productData.pimage || '',
        productData.pcat || '',
        productData.preg || 0,
        toBoolInt(productData.sold || false),
        productData.status || 'pending',
        toSqliteDatetime(productData.expiresAt),
        toSqliteDatetime(new Date()),
        toSqliteDatetime(new Date())
      ]
    });
    return id;
  } catch (error) {
    console.log("Error creating product:", error);
    throw error;
  }
};

const getPendingProducts = async () => {
  const client = getTursoClient();
  try {
    const result = await client.execute({
      sql: `SELECT * FROM products 
            WHERE sold = 0 AND status = 'pending'
            ORDER BY preg DESC`
    });
    return result.rows || [];
  } catch (error) {
    console.log("Error getting pending products:", error);
    return [];
  }
};

const approveProduct = async (productId, approvedBy) => {
  const client = getTursoClient();
  try {
    await client.execute({
      sql: `UPDATE products 
            SET status = 'approved', approved_at = ?, approved_by = ?, updated_at = ?
            WHERE id = ?`,
      args: [toSqliteDatetime(new Date()), approvedBy, toSqliteDatetime(new Date()), productId]
    });
    return true;
  } catch (error) {
    console.log("Error approving product:", error);
    throw error;
  }
};

const rejectProduct = async (productId, rejectedBy) => {
  const client = getTursoClient();
  try {
    await client.execute({
      sql: `UPDATE products
            SET status = 'rejected', rejected_at = ?, rejected_by = ?, updated_at = ?
            WHERE id = ?`,
      args: [toSqliteDatetime(new Date()), rejectedBy, toSqliteDatetime(new Date()), productId]
    });
    return true;
  } catch (error) {
    console.log("Error rejecting product:", error);
    throw error;
  }
};

const updateProduct = async (productId, updates) => {
  const client = getTursoClient();
  try {
    const setClauses = [];
    const args = [];
    
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = ?`);
      if (key.includes('_at') || key === 'expiresAt' || key === 'expires_at') {
        args.push(toSqliteDatetime(value));
      } else if (key === 'sold') {
        args.push(toBoolInt(value));
      } else {
        args.push(value);
      }
    }

    setClauses.push("updated_at = ?");
    args.push(toSqliteDatetime(new Date()));
    args.push(productId);

    if (setClauses.length > 1) {
      await client.execute({
        sql: `UPDATE products SET ${setClauses.join(', ')} WHERE id = ?`,
        args
      });
    }
    return true;
  } catch (error) {
    console.log("Error updating product:", error);
    throw error;
  }
};

// Bid queries
const getBidForProduct = async (productId) => {
  const client = getTursoClient();
  try {
    const result = await client.execute({
      sql: "SELECT * FROM bids WHERE product_id = ?",
      args: [productId]
    });
    if (result.rows.length > 0) {
      const bid = result.rows[0];
      // Get bid entries
      const entriesResult = await client.execute({
        sql: "SELECT * FROM bid_entries WHERE bid_id = ? ORDER BY bid_time DESC",
        args: [bid.id]
      });
      bid.bids = entriesResult.rows || [];
      return bid;
    }
    return null;
  } catch (error) {
    console.log("Error getting bid for product:", error);
    return null;
  }
};

// Message queries
const saveMessage = async (messageData) => {
  const client = getTursoClient();
  try {
    const id = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO messages 
            (id, product_id, sender_id, receiver_id, message, timestamp, is_read)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        messageData.productId,
        messageData.senderId,
        messageData.receiverId,
        messageData.message,
        toSqliteDatetime(new Date()),
        0
      ]
    });
    return id;
  } catch (error) {
    console.log("Error saving message:", error);
    throw error;
  }
};

const getMessages = async (productId, userId, otherUserId) => {
  const client = getTursoClient();
  try {
    const result = await client.execute({
      sql: `SELECT * FROM messages 
            WHERE product_id = ? 
            AND (
              (sender_id = ? AND receiver_id = ?) OR
              (sender_id = ? AND receiver_id = ?)
            )
            ORDER BY timestamp ASC`,
      args: [productId, userId, otherUserId, otherUserId, userId]
    });
    return result.rows || [];
  } catch (error) {
    console.log("Error getting messages:", error);
    return [];
  }
};

const markMessagesAsRead = async (productId, receiverId, senderId) => {
  const client = getTursoClient();
  try {
    await client.execute({
      sql: `UPDATE messages 
            SET is_read = 1
            WHERE product_id = ? AND receiver_id = ? AND sender_id = ?`,
      args: [productId, receiverId, senderId]
    });
    return true;
  } catch (error) {
    console.log("Error marking messages as read:", error);
    throw error;
  }
};

// User token queries  
const createUserToken = async (userId, token) => {
  const client = getTursoClient();
  try {
    const id = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO user_tokens (id, user_id, token, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        id,
        userId,
        token,
        toSqliteDatetime(new Date()),
        toSqliteDatetime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))  // 7 days
      ]
    });
    return id;
  } catch (error) {
    console.log("Error creating user token:", error);
    throw error;
  }
};

const getUserTokenByToken = async (token) => {
  const client = getTursoClient();
  try {
    const result = await client.execute({
      sql: "SELECT * FROM user_tokens WHERE token = ?",
      args: [token]
    });
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.log("Error getting user token:", error);
    return null;
  }
};

const deleteUserToken = async (token) => {
  const client = getTursoClient();
  try {
    await client.execute({
      sql: "DELETE FROM user_tokens WHERE token = ?",
      args: [token]
    });
    return true;
  } catch (error) {
    console.log("Error deleting user token:", error);
    throw error;
  }
};

module.exports = {
  toSqliteDatetime,
  fromSqliteDatetime,
  toBoolInt,
  fromBoolInt,
  // User
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  // OTP
  createOtp,
  getLatestOtpForUser,
  markOtpAsConsumed,
  deleteOtpsForUser,
  // Product
  getApprovedProducts,
  searchProducts,
  getProductById,
  createProduct,
  getPendingProducts,
  approveProduct,
  rejectProduct,
  updateProduct,
  // Bid
  getBidForProduct,
  // Message
  saveMessage,
  getMessages,
  markMessagesAsRead,
  // User Token
  createUserToken,
  getUserTokenByToken,
  deleteUserToken,
};
