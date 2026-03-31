// Turso SQL imports
const { getTursoClient } = require("../db/tursoClient");
let {
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  createOtp,
  getLatestOtpForUser,
  markOtpAsConsumed,
  deleteOtpsForUser,
  findValidOtpForUser,
  deleteAllOtpsForUser,
  updateUserPassword,
  getApprovedProducts,
  searchProducts,
  getProductById,
  createProduct,
  updateProduct,
  getBidForProduct,
  saveMessage: saveMessageDb,
  getMessages: getMessagesDb,
  markMessagesAsRead,
  createUserToken,
  getUserTokenByToken,
  deleteUserToken,
  toSqliteDatetime,
  fromSqliteDatetime,
  toBoolInt,
  fromBoolInt,
  approveProduct: approveProductDb,
  rejectProduct: rejectProductDb,
} = require("../db/sqlHelpers");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const verifyRefreshToken = require("../utils/verifyRefreshToken");
const generateTokens = require("../utils/generateToken.js");

const OTP_TTL_MINUTES = 10;
const UNVERIFIED_ACCOUNT_TTL_MS = 60 * 60 * 1000;
const LISTING_EXPIRY_DAYS = parseInt(process.env.LISTING_EXPIRY_DAYS) || 7;
const MAX_PRODUCT_IMAGE_BYTES = 14 * 1024 * 1024;
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;
const PRODUCT_APPROVAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const getDataUrlByteSize = (dataUrl) => {
  if (typeof dataUrl !== "string") {
    return 0;
  }

  const parts = dataUrl.split(",");
  if (parts.length !== 2 || !parts[0].includes(";base64")) {
    return 0;
  }

  const base64Data = parts[1];
  const padding = (base64Data.match(/=*$/) || [""])[0].length;
  return Math.floor((base64Data.length * 3) / 4) - padding;
};

const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const hashOtp = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");

const verifyOtpCode = (code, hash) => {
  return crypto.createHash("sha256").update(code).digest("hex") === hash;
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

// Helper: Convert UTC string to SQLite format
// (Already imported from sqlHelpers)

const findUserByEmail = async (email) => {
  const normalized = normalizeEmail(email);
  return getUserByEmail(normalized);
};

const findUserById = async (id) => {
  return getUserById(id);
};

const getUnverifiedExpiryFromUser = (user) => {
  if (!user || user.verified) {
    return null;
  }

  if (user.verificationExpiresAt) {
    return new Date(user.verificationExpiresAt);
  }

  // Backward compatibility for legacy records without verificationExpiresAt.
  const createdAtFromObjectId = user?._id?.getTimestamp?.();
  if (createdAtFromObjectId) {
    return new Date(createdAtFromObjectId.getTime() + UNVERIFIED_ACCOUNT_TTL_MS);
  }

  return null;
};

const isUnverifiedAccountExpired = (user) => {
  if (!user || user.verified) {
    return false;
  }

  const expiresAt = getUnverifiedExpiryFromUser(user);
  if (!expiresAt) {
    return false;
  }

  return expiresAt <= new Date();
};

const deleteExpiredUnverifiedAccountIfNeeded = async (user) => {
  if (!isUnverifiedAccountExpired(user)) {
    return false;
  }

  const client = getTursoClient();
  try {
    // Delete OTPs for this user with register purpose
    await client.execute({
      sql: "DELETE FROM otps WHERE user_id = ? AND purpose = 'register'",
      args: [user.id]
    });
    
    // Delete the unverified user
    await client.execute({
      sql: "DELETE FROM users WHERE id = ? AND verified = 0",
      args: [user.id]
    });
    
    return true;
  } catch (error) {
    console.log("Error deleting expired unverified account:", error);
    return false;
  }
};

const getUnverifiedAccountExpiryDate = () =>
  new Date(Date.now() + UNVERIFIED_ACCOUNT_TTL_MS);

// Helper: Build SQL WHERE clause for approved, non-expired, unsold products
const buildApprovedProductFilter = () => {
  const now = new Date().toISOString();
  return {
    whereClause: "WHERE sold = 0 AND (status = 'approved' OR status IS NULL OR status = '') AND (expires_at IS NULL OR expires_at > ?)",
    args: [now]
  };
};

const attachSellerTrustMeta = async (products) => {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const sellerIds = [
    ...new Set(
      products
        .map((product) => product?.seller_id?.toString?.() || product?.seller_id)
        .filter(Boolean)
    ),
  ];

  if (sellerIds.length === 0) {
    return products;
  }

  const client = getTursoClient();
  try {
    const placeholders = sellerIds.map(() => "?").join(",");
    const result = await client.execute({
      sql: `SELECT id, seller_verified, seller_rating, seller_rating_count FROM users WHERE id IN (${placeholders})`,
      args: sellerIds
    });

    const sellerMetaById = new Map(
      result.rows.map((seller) => [seller.id, seller])
    );

    return products.map((product) => {
      const sellerMeta = sellerMetaById.get(product?.seller_id) || {};
      return {
        ...product,
        sellerVerified: fromBoolInt(sellerMeta.seller_verified),
        sellerRating: Number(sellerMeta.seller_rating || 0),
        sellerRatingCount: Number(sellerMeta.seller_rating_count || 0),
      };
    });
  } catch (error) {
    console.log("Error attaching seller trust meta:", error);
    return products;
  }
};

const getUserFromRefreshToken = async (refreshToken) => {
  if (!refreshToken) {
    return null;
  }

  const client = getTursoClient();
  try {
    // First check if refresh token exists
    const tokenResult = await client.execute({
      sql: "SELECT user_id FROM user_tokens WHERE token = ?",
      args: [refreshToken]
    });
    
    if (tokenResult.rows.length === 0) {
      return null;
    }

    const userId = tokenResult.rows[0].user_id;

    // Verify JWT token
    let tokenDetails;
    try {
      tokenDetails = jwt.verify(
        refreshToken,
        process.env.JWTREFRESHPRIVATEKEY
      );
    } catch (error) {
      return null;
    }

    if (!tokenDetails?._id && !tokenDetails?.id) {
      return null;
    }

    const lookupId = tokenDetails._id || tokenDetails.id;

    // Get user from database
    const userResult = await client.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [lookupId]
    });

    if (userResult.rows.length === 0) {
      return null;
    }

    return userResult.rows[0];
  } catch (error) {
    console.log("Error getting user from refresh token:", error);
    return null;
  }
};

const isApprovedProduct = (product) =>
  !product?.status || product.status === PRODUCT_APPROVAL_STATUS.APPROVED;

const isProductExpired = (product) => {
  const expiresAt = product?.expires_at || product?.expiresAt;
  if (!expiresAt) return false;
  return new Date(expiresAt) <= new Date();
};

const canViewProduct = (product, user) => {
  if (!product) {
    return false;
  }

  const approved = isApprovedProduct(product);
  const expired = isProductExpired(product);

  // Public can see approved, non-expired products
  if (approved && !expired) {
    return true;
  }

  // Logged-in check required for pending/rejected/expired
  if (!user) {
    return false;
  }

  // Admin sees everything
  if (user.role === "admin") {
    return true;
  }

  // Seller can always see their own listing (to renew, etc.)
  const productOwnerId = product.seller_id || product.id;
  const viewerId = user.id || user._id;
  return productOwnerId?.toString() === viewerId?.toString();
};

const requireAdminUser = async (req, res) => {
  const user = await getUserFromRefreshToken(req.body?.token);

  if (!user || user.role !== "admin") {
    res.status(403).send({ error: true, message: "Admin access required" });
    return null;
  }

  return user;
};

const issuePending2FAToken = (userId) =>
  jwt.sign({ _id: userId, stage: "pending-2fa" }, process.env.JWTPRIVATEKEY, {
    expiresIn: "12m",
  });

const issuePendingRegisterToken = (userId) =>
  jwt.sign({ _id: userId, stage: "pending-register" }, process.env.JWTPRIVATEKEY, {
    expiresIn: "15m",
  });

const normalizeProductId = (value) => {
  if (typeof value === "string" || typeof value === "number") {
    const normalized = String(value).trim();
    return normalized || null;
  }

  if (value && typeof value === "object") {
    const candidate = value.id || value._id || value.productId || value.value;
    if (typeof candidate === "string" || typeof candidate === "number") {
      const normalized = String(candidate).trim();
      return normalized || null;
    }
  }

  return null;
};

const createAndSendOtp = async (user) => {
  const client = getTursoClient();
  try {
    // Delete old OTPs
    await client.execute({
      sql: "DELETE FROM otps WHERE user_id = ? AND purpose = 'login'",
      args: [user.id]
    });

    const code = generateOtpCode();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    const id = crypto.randomUUID();

    await client.execute({
      sql: `INSERT INTO otps (id, user_id, code_hash, expires_at, purpose, consumed)
            VALUES (?, ?, ?, ?, 'login', 0)`,
      args: [id, user.id, codeHash, toSqliteDatetime(expiresAt)]
    });

    const emailText = `Your Unimarket login code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`;
    // Send email in background (non-blocking)
    sendEmail(user.mail, "Your Unimarket login code", emailText).catch((err) => {
      console.log("OTP email send failed", err?.message || err);
    });

    // Dev fallback: log OTP to console so QA can proceed if email is misconfigured
    if (process.env.NODE_ENV !== "production") {
      console.log(`DEV OTP for ${user.mail}: ${code}`);
    }

    return {
      expiresAt,
      code: process.env.NODE_ENV !== "production" ? code : undefined,
    };
  } catch (error) {
    console.log("Error creating/sending OTP:", error);
    throw error;
  }
};

const createAndSendRegisterOtp = async (user) => {
  const client = getTursoClient();
  try {
    // Delete old OTPs
    await client.execute({
      sql: "DELETE FROM otps WHERE user_id = ? AND purpose = 'register'",
      args: [user.id]
    });

    const code = generateOtpCode();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    const id = crypto.randomUUID();

    await client.execute({
      sql: `INSERT INTO otps (id, user_id, code_hash, expires_at, purpose, consumed)
            VALUES (?, ?, ?, ?, 'register', 0)`,
      args: [id, user.id, codeHash, toSqliteDatetime(expiresAt)]
    });

    const emailText = `Your Unimarket registration code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`;
    sendEmail(user.mail, "Verify your Unimarket account", emailText).catch((err) => {
      console.log("Register OTP email send failed", err?.message || err);
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`DEV Register OTP for ${user.mail}: ${code}`);
    }

    return {
      expiresAt,
      code: process.env.NODE_ENV !== "production" ? code : undefined,
    };
  } catch (error) {
    console.log("Error creating/sending register OTP:", error);
    throw error;
  }
};

const login = async (req, res) => {
  try {
    const user = await findUserByEmail(req.body.mail);
    if (!user) {
      return res.status(401).send({ message: "Invalid Email or Password" });
    }
    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!validPassword) {
      return res.status(401).send({ message: "Invalid Email or Password" });
    }
    if (!fromBoolInt(user.verified)) {
      const expiredAndDeleted = await deleteExpiredUnverifiedAccountIfNeeded(user);
      if (expiredAndDeleted) {
        return res.status(400).send({ message: "Your unverified account expired after 1 hour. Please register again." });
      }
      return res.status(400).send({ message: "Please verify your email to complete registration." });
    }

    const { accessToken, refreshToken } = await generateTokens(user);
    res.status(200).send({ accessToken, refreshToken, message: "Signed in successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

const verifyOtp = async (req, res) => {
  const client = getTursoClient();
  try {
    const { pendingToken, code } = req.body;
    if (!pendingToken || !code) {
      return res.status(400).send({ message: "Pending token and code are required" });
    }

    let payload;
    try {
      payload = jwt.verify(pendingToken, process.env.JWTPRIVATEKEY);
    } catch (err) {
      return res.status(401).send({ message: "Invalid or expired pending token" });
    }

    if (payload.stage !== "pending-2fa") {
      return res.status(400).send({ message: "Invalid token stage" });
    }

    const otpResult = await client.execute({
      sql: `SELECT * FROM otps 
            WHERE user_id = ? AND purpose = 'login' AND consumed = 0
            ORDER BY created_at DESC LIMIT 1`,
      args: [payload._id]
    });

    if (otpResult.rows.length === 0) {
      return res.status(400).send({ message: "OTP not found. Please request a new code." });
    }

    const otpDoc = otpResult.rows[0];

    if (fromSqliteDatetime(otpDoc.expires_at) < new Date()) {
      await client.execute({
        sql: "DELETE FROM otps WHERE user_id = ? AND purpose = 'login'",
        args: [payload._id]
      });
      return res.status(400).send({ message: "OTP expired. Please request a new code." });
    }

    const isValid = otpDoc.code_hash === hashOtp(code.trim());
    if (!isValid) {
      return res.status(401).send({ message: "Invalid code" });
    }

    // Mark OTP as consumed
    await client.execute({
      sql: "UPDATE otps SET consumed = 1 WHERE id = ?",
      args: [otpDoc.id]
    });

    const userResult = await client.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [payload._id]
    });

    if (userResult.rows.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    const user = userResult.rows[0];
    const { accessToken, refreshToken } = await generateTokens(user);
    
    // Delete consumed OTPs
    await client.execute({
      sql: "DELETE FROM otps WHERE user_id = ? AND purpose = 'login' AND consumed = 1",
      args: [payload._id]
    });

    res.status(200).send({
      message: "2FA verified",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { pendingToken } = req.body;
    if (!pendingToken) {
      return res.status(400).send({ message: "Pending token is required" });
    }

    let payload;
    try {
      payload = jwt.verify(pendingToken, process.env.JWTPRIVATEKEY);
    } catch (err) {
      return res.status(401).send({ message: "Invalid or expired pending token" });
    }

    if (payload.stage !== "pending-2fa") {
      return res.status(400).send({ message: "Invalid token stage" });
    }

    const client = getTursoClient();
    const userResult = await client.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [payload._id]
    });

    if (userResult.rows.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    const user = userResult.rows[0];

    await createAndSendOtp(user);
    const newPendingToken = issuePending2FAToken(user.id);

    res.status(200).send({
      message: "OTP resent",
      pendingToken: newPendingToken,
      expiresInMinutes: OTP_TTL_MINUTES,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

const register = async (req, res) => {
  try {
    const normalizedMail = normalizeEmail(req.body.mail);

    if (!normalizedMail.endsWith("@rtu.edu.ph")) {
      return res.status(400).send({
        message: "Please use your RTU email (must end with @rtu.edu.ph)!",
        info: "invalidEmail",
      });
    }

    let user = await findUserByEmail(normalizedMail);
    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashPassword = await bcrypt.hash(req.body.password, salt);

    if (user) {
      if (fromBoolInt(user.verified)) {
        console.log("user exist");
        return res.status(200).send({
          message: "User with given email already Exist!",
          info: "userExist",
        });
      }

      const expiredAndDeleted = await deleteExpiredUnverifiedAccountIfNeeded(user);
      if (expiredAndDeleted) {
        user = null;
      }
    }

    if (user) {
      // Recover stale/unverified accounts by refreshing profile data and resending OTP.
      await updateUser(user.id, {
        name: req.body.name,
        mail: normalizedMail,
        address: req.body.address,
        phone: req.body.phone,
        password: hashPassword,
        verified: false,
        verification_expires_at: getUnverifiedAccountExpiryDate(),
      });

      user = await getUserById(user.id);
      await createAndSendRegisterOtp(user);

      const regPendingToken = issuePendingRegisterToken(user.id);
      return res.status(200).send({
        message: "An unverified account already exists. We sent a new OTP to continue.",
        info: "otpSent",
        pendingToken: regPendingToken,
        expiresInMinutes: OTP_TTL_MINUTES,
      });
    }

    const userId = crypto.randomUUID();
    await createUser({
      id: userId,
      name: req.body.name,
      mail: normalizedMail,
      address: req.body.address,
      phone: req.body.phone,
      password: hashPassword,
      course: req.body.course,
      verified: false,
      verificationExpiresAt: getUnverifiedAccountExpiryDate(),
    });

    user = await getUserById(userId);
    await createAndSendRegisterOtp(user);

    const regPendingToken = issuePendingRegisterToken(user.id);

    res.status(201).send({
      message: "OTP sent to your email. Please verify to complete registration.",
      info: "otpSent",
      pendingToken: regPendingToken,
      expiresInMinutes: OTP_TTL_MINUTES,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

const verifyRegisterOtp = async (req, res) => {
  try {
    const { pendingToken, code } = req.body;
    if (!pendingToken || !code) {
      return res.status(400).send({ message: "Pending token and code are required" });
    }

    let payload;
    try {
      payload = jwt.verify(pendingToken, process.env.JWTPRIVATEKEY);
    } catch (err) {
      return res.status(401).send({ message: "Invalid or expired token. Please register again." });
    }

    if (payload.stage !== "pending-register") {
      return res.status(400).send({ message: "Invalid token stage" });
    }

    const user = await getUserById(payload._id);
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const expiredAndDeleted = await deleteExpiredUnverifiedAccountIfNeeded(user);
    if (expiredAndDeleted) {
      return res.status(400).send({ message: "Your unverified account expired after 1 hour. Please register again." });
    }

    const otpDoc = await getLatestOtpForUser(payload._id, "register");

    if (!otpDoc) {
      return res.status(400).send({ message: "OTP not found. Please register again." });
    }

    if (fromSqliteDatetime(otpDoc.expires_at) < new Date()) {
      await deleteOtpsForUser(payload._id, "register");
      return res.status(400).send({ message: "OTP expired. Please register again." });
    }

    const isValid = otpDoc.code_hash === hashOtp(code.trim());
    if (!isValid) {
      return res.status(401).send({ message: "Invalid code. Please try again." });
    }

    await markOtpAsConsumed(otpDoc.id);

    await updateUser(payload._id, {
      verified: true,
      verification_expires_at: null
    });
    await deleteOtpsForUser(payload._id, "register");

    res.status(200).send({
      message: "Email verified! Registration complete. You can now log in.",
      info: "registered",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

const resendRegisterOtp = async (req, res) => {
  try {
    const { pendingToken } = req.body;
    if (!pendingToken) {
      return res.status(400).send({ message: "Pending token is required" });
    }

    let payload;
    try {
      payload = jwt.verify(pendingToken, process.env.JWTPRIVATEKEY);
    } catch (err) {
      return res.status(401).send({ message: "Invalid or expired token. Please register again." });
    }

    if (payload.stage !== "pending-register") {
      return res.status(400).send({ message: "Invalid token stage" });
    }

    const user = await getUserById(payload._id);
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    if (fromBoolInt(user.verified)) {
      return res.status(400).send({ message: "Account already verified. Please log in." });
    }

    const expiredAndDeleted = await deleteExpiredUnverifiedAccountIfNeeded(user);
    if (expiredAndDeleted) {
      return res.status(400).send({ message: "Your unverified account expired after 1 hour. Please register again." });
    }

    await createAndSendRegisterOtp(user);
    const newPendingToken = issuePendingRegisterToken(user.id);

    res.status(200).send({
      message: "Registration OTP resent",
      pendingToken: newPendingToken,
      expiresInMinutes: OTP_TTL_MINUTES,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

const verify = async (req, res) => {
  const client = getTursoClient();
  try {
    const userId = req.params.id;
    const verificationToken = req.params.token;

    // For now, since we don't have verification_tokens table in use,
    // we'll skip token validation and just mark user as verified
    // This maintains backward compatibility
    const user = await getUserById(userId);
    if (!user) {
      return res.status(400).send({ message: "Invalid link" });
    }

    // Mark user as verified
    await updateUser(userId, { verified: true, verification_expires_at: null });

    res.status(200).send({ message: "Email verified successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

const token = async (req, res) => {
  verifyRefreshToken(req.body.token)
    .then(async ({ tokenDetails }) => {
      const payload = { _id: tokenDetails._id, role: tokenDetails.role };
      const accessToken = jwt.sign(payload, process.env.JWTPRIVATEKEY, {
        expiresIn: "14m",
      });
      
      // Get seller notifications from SQL (bids for this seller's products)
      const client = getTursoClient();
      try {
        // Get all bids where seller is the owner of the product
        const bidsResult = await client.execute({
          sql: `SELECT 
                  b.id, b.product_id, b.seller_id,
                  p.id as pimage, p.pname, p.pprice,
                  be.buyer_id, be.bid_price, be.cancelled
                FROM bids b
                JOIN products p ON b.product_id = p.id
                LEFT JOIN bid_entries be ON b.id = be.bid_id
                WHERE b.seller_id = ?`,
          args: [tokenDetails._id]
        });
        
        let findata = [];
        if (bidsResult.rows && bidsResult.rows.length > 0) {
          for (const bid of bidsResult.rows) {
            if (fromBoolInt(bid.cancelled)) continue;
            
            const buyer = await getUserById(bid.buyer_id);
            if (!buyer) continue;
            
            findata.push({
              prodId: bid.product_id,
              href: `/buy-product/${bid.product_id}/${tokenDetails._id}/${bid.buyer_id}`,
              imageURL: bid.pimage,
              reg: buyer.name,
              pname: bid.pname,
              bprice: bid.bid_price,
              cancel: fromBoolInt(bid.cancelled),
              bid: bid.buyer_id,
            });
          }
        }
        
        console.log(`Returning ${findata.length} notifications to client for user ${tokenDetails._id}`);
        res.status(200).send({
          error: false,
          userid: tokenDetails._id,
          allNotifications: findata,
          role: tokenDetails.role,
          message: "Access token created successfully",
        });
      } catch (error) {
        console.log("Error fetching notifications:", error);
        // Return empty notifications if query fails
        res.status(200).send({
          error: false,
          userid: tokenDetails._id,
          allNotifications: [],
          role: tokenDetails.role,
          message: "Access token created successfully",
        });
      }
    })
    .catch((err) => {
      console.log(err);
      res.status(400).send(err);
    });
};

const delToken = async (req, res) => {
  try {
    const token = await getUserTokenByToken(req.body.refreshToken);
    if (!token) {
      return res
        .status(200)
        .send({ error: false, message: "Logged Out Sucessfully" });
    }

    await deleteUserToken(req.body.refreshToken);
    res.status(200).send({ error: false, message: "Logged Out Sucessfully" });
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: true, message: "Internal Server Error" });
  }
};

const fixdeal = async (req, res) => {
  try {
    const { productid, sellerid, buyerid } = req.body;
    const product = await getProductById(productid);
    if (!product) {
      return res.status(404).send({ error: true, message: "Product not found" });
    }

    let findata = {
      pname: product.pname,
      productprice: product.pprice,
      pimage: product.pimage,
    };

    const biddata = await getBidForProduct(productid);
    for (const bidEntry of biddata?.bids || []) {
      if (bidEntry.buyer_id?.toString() === buyerid?.toString()) {
        findata = { ...findata, bidprice: bidEntry.bid_price };
        break;
      }
    }

    const buyer = await getUserById(buyerid);
    if (buyer) {
      findata = { ...findata, buyername: buyer.name, mail: buyer.mail };
    }

    res.status(200).send({ fixdeal: findata });
  } catch (error) {
    console.log(error);
    res.status(300).send({ error: true });
  }
};

const profile = async (req, res) => {
  const client = getTursoClient();
  try {
    const { id } = req.body;
    const user = await getUserById(id);

    // Get user's bids
    const bidsResult = await client.execute({
      sql: `SELECT be.*, b.id as bid_id, p.pname, p.pimage, p.pprice
            FROM bid_entries be
            JOIN bids b ON be.bid_id = b.id
            JOIN products p ON b.product_id = p.id
            WHERE be.buyer_id = ?`,
      args: [id]
    });
    
    const arr = (bidsResult.rows || []).map(row => ({
      pname: row.pname,
      pimage: row.pimage,
      bidPrice: row.bid_price,
      bidtime: row.bid_time,
      bid: id,
      pid: row.product_id,
      pprice: row.pprice,
    }));

    // Get user's products
    const productsResult = await client.execute({
      sql: `SELECT * FROM products WHERE seller_id = ?`,
      args: [id]
    });

    const myprodData = (productsResult.rows || []).map(prod => ({
      id: prod.id,
      pname: prod.pname,
      pprice: prod.pprice,
      pimage: prod.pimage,
      preg: prod.preg || 0,
      status: prod.status || PRODUCT_APPROVAL_STATUS.APPROVED,
      expiresAt: prod.expires_at || null,
    }));

    // Get purchased items
    const purchasedResult = await client.execute({
      sql: `SELECT * FROM products WHERE sold_to = ? AND sold = 1`,
      args: [id]
    });

    const myPurchases = (purchasedResult.rows || []).map(prod => ({
      id: prod.id,
      pname: prod.pname,
      pprice: prod.pprice,
      soldPrice: prod.sold_price,
      pimage: prod.pimage,
      preg: prod.preg || 0,
    }));

    if (!user) {
      return res.status(400).send({
        error: true,
        message: "User not found",
        data: user,
        mybids: arr,
        myproducts: myprodData,
        mypurchases: myPurchases,
      });
    }

    res.status(200).send({
      erro: false,
      data: user,
      mybids: arr,
      myproducts: myprodData,
      mypurchases: myPurchases
    });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true });
  }
};

const deletemyprod = async (req, res) => {
  const client = getTursoClient();
  try {
    const { pid } = req.body;
    await client.execute({ sql: "DELETE FROM bid_entries WHERE bid_id IN (SELECT id FROM bids WHERE product_id = ?)", args: [pid] });
    await client.execute({ sql: "DELETE FROM bids WHERE product_id = ?", args: [pid] });
    await client.execute({ sql: "DELETE FROM products WHERE id = ?", args: [pid] });
    res.status(200).send({ error: false });
  } catch (error) {
    res.status(400).send({ error: true });
  }
};

const delAcc = async (req, res) => {
  const client = getTursoClient();
  try {
    const id = req.body.id;
    await client.execute({ sql: "DELETE FROM user_tokens WHERE user_id = ?", args: [id] });
    await client.execute({ sql: "DELETE FROM bids WHERE seller_id = ?", args: [id] });
    await client.execute({ sql: "DELETE FROM products WHERE seller_id = ?", args: [id] });
    await client.execute({ sql: "DELETE FROM users WHERE id = ?", args: [id] });
    res.status(200).send({ error: false, message: "Account deleted Successfully" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true });
  }
};

const logout = async (req, res) => {
  const client = getTursoClient();
  try {
    const userId = req.body.id;
    await client.execute({ sql: "DELETE FROM user_tokens WHERE user_id = ?", args: [userId] });
    res.status(200).send({ error: false, message: "Logged out successfully" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true });
  }
};

const update = async (req, res) => {
  try {
    const incomingData = req.body.newData || {};
    const newData = {
      name: incomingData.name,
      course: incomingData.course,
      address: incomingData.address,
      phone: incomingData.phone,
    };
    const id = req.body.id;
    await updateUser(id, newData);
    res.status(200).send({ error: false, message: "Updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true });
  }
};

const displayProd = async (req, res) => {
  try {
    const data = await getApprovedProducts();
    const productsWithSellerMeta = await attachSellerTrustMeta(data);
    res.status(200).send({ error: false, details: productsWithSellerMeta });
  } catch (error) {
    console.log("Error: ", error);
    res.status(400).send({ error: true });
  }
};

const searchproduct = async (req, res) => {
  try {
    const searchval = (req.body.searchval || "").trim();

    const data = await searchProducts(searchval);
    const dataWithSellerMeta = await attachSellerTrustMeta(data);

    res.status(200).send({ mysearchdata: dataWithSellerMeta });
  } catch (error) {
    console.log("searchproduct error", error);
    res.status(400).send({ error: true, message: "Search failed" });
  }
};

const getVerifiedShops = async (req, res) => {
  const client = getTursoClient();
  try {
    const now = new Date().toISOString();

    const sellersResult = await client.execute({
      sql: `SELECT id, name, mail, seller_verified, seller_rating, seller_rating_count
            FROM users
            WHERE seller_verified = 1
            ORDER BY seller_rating DESC, seller_rating_count DESC, name ASC`,
    });

    const productsResult = await client.execute({
      sql: `SELECT id, seller_id, pname, pprice, pimage, pcat, pdate, preg
            FROM products
            WHERE sold = 0
              AND (status = 'approved' OR status IS NULL OR status = '')
              AND (expires_at IS NULL OR expires_at > ?)
            ORDER BY created_at DESC`,
      args: [now],
    });

    const productsBySeller = new Map();
    for (const product of productsResult.rows || []) {
      const existing = productsBySeller.get(product.seller_id) || [];
      existing.push(product);
      productsBySeller.set(product.seller_id, existing);
    }

    const shops = (sellersResult.rows || []).map((seller) => ({
      sellerId: seller.id,
      name: seller.name,
      mail: seller.mail,
      sellerVerified: fromBoolInt(seller.seller_verified),
      sellerRating: Number(seller.seller_rating || 0),
      sellerRatingCount: Number(seller.seller_rating_count || 0),
      products: productsBySeller.get(seller.id) || [],
    }));

    res.status(200).send({ error: false, shops });
  } catch (error) {
    console.log("Error loading verified shops:", error);
    res.status(400).send({ error: true, message: "Failed to load verified shops" });
  }
};

const toLegacyBidPayload = (bidRecord) => {
  if (!bidRecord) {
    return null;
  }

  return {
    prodId: bidRecord.product_id,
    sellerId: bidRecord.seller_id || "",
    bids: (bidRecord.bids || []).map((entry) => ({
      buyerId: entry.buyer_id,
      bidPrice: entry.bid_price,
      bidTime: entry.bid_time,
      regno: entry.regno,
      cancel: fromBoolInt(entry.cancelled),
    })),
  };
};

const prodData = async (req, res) => {
  try {
    const id = req.body.id;
    const requestingUser = await getUserFromRefreshToken(req.body.token);
    const data = await getProductById(id);
    if (!data) {
      return res.status(404).send({ error: true, message: "Product not found" });
    }

    if (!canViewProduct(data, requestingUser)) {
      const expired = isProductExpired(data);
      return res.status(404).send({
        error: true,
        message: expired
          ? "This listing has expired"
          : "Product is awaiting admin approval",
      });
    }

    const bid = await getBidForProduct(id);
    const seller = await getUserById(data.seller_id || data.id);
    if (!seller) {
      return res.status(404).send({ error: true, message: "Seller not found" });
    }

    const sellerVerified = fromBoolInt(seller.seller_verified ?? seller.sellerVerified);
    const sellerRating = Number(seller.seller_rating ?? seller.sellerRating ?? 0);
    const sellerRatingCount = Number(seller.seller_rating_count ?? seller.sellerRatingCount ?? 0);
    const isExpired = isProductExpired(data);
    res
      .status(200)
      .send({
        error: false,
        details: {
          data,
          bid: toLegacyBidPayload(bid),
          name: seller.name,
          mail: seller.mail,
          phone: seller.phone,
          sellerVerified,
          sellerRating,
          sellerRatingCount,
        },
        isExpired,
      });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true });
  }
};

const sell = async (req, res) => {
  try {
    const { pdata, id } = req.body;

    const imageSizeInBytes = getDataUrlByteSize(pdata?.pimage);
    if (imageSizeInBytes > MAX_PRODUCT_IMAGE_BYTES) {
      return res.status(413).send({
        error: true,
        message: "Image size must be 14MB or less",
      });
    }

    const expiresAt = new Date(
      Date.now() + LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );
    
    await createProduct({
      ...pdata,
      id,
      seller_id: id,
      status: PRODUCT_APPROVAL_STATUS.PENDING,
      expiresAt,
    });
    
    res.status(200).send({ error: false, message: "Product submitted for admin approval" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true, message: "Product wasn't added" });
  }
};

const getPendingProducts = async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req, res);
    if (!adminUser) {
      return;
    }

    const client = getTursoClient();
    const result = await client.execute({
      sql: `SELECT * FROM products 
            WHERE sold = 0 AND status = 'pending'
            ORDER BY preg DESC`
    });

    res.status(200).send({ error: false, details: result.rows || [] });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true, message: "Failed to load pending products" });
  }
};

const approveProduct = async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req, res);
    if (!adminUser) {
      return;
    }

    const productId = normalizeProductId(req.body?.productId);
    if (!productId) {
      return res.status(400).send({ error: true, message: "Invalid productId" });
    }
    const client = getTursoClient();
    
    const product = await getProductById(productId);
    if (!product) {
      return res.status(404).send({ error: true, message: "Product not found" });
    }

    await client.execute({
      sql: `UPDATE products 
            SET status = 'approved', approved_at = ?, approved_by = ?, rejected_at = NULL, rejected_by = NULL, updated_at = ?
            WHERE id = ?`,
      args: [toSqliteDatetime(new Date()), adminUser.id, toSqliteDatetime(new Date()), productId]
    });

    res.status(200).send({ error: false, message: "Product approved" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true, message: "Failed to approve product" });
  }
};

const rejectProduct = async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req, res);
    if (!adminUser) {
      return;
    }

    const productId = normalizeProductId(req.body?.productId);
    if (!productId) {
      return res.status(400).send({ error: true, message: "Invalid productId" });
    }
    const client = getTursoClient();
    
    const product = await getProductById(productId);
    if (!product) {
      return res.status(404).send({ error: true, message: "Product not found" });
    }

    await client.execute({
      sql: `UPDATE products 
            SET status = 'rejected', rejected_at = ?, rejected_by = ?, approved_at = NULL, approved_by = NULL, updated_at = ?
            WHERE id = ?`,
      args: [toSqliteDatetime(new Date()), adminUser.id, toSqliteDatetime(new Date()), productId]
    });

    res.status(200).send({ error: false, message: "Product rejected" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true, message: "Failed to reject product" });
  }
};

const getAdminAllProducts = async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req, res);
    if (!adminUser) return;

    const { search, statusFilter } = req.body;
    const client = getTursoClient();
    const where = [];
    const args = [];

    if (statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)) {
      where.push("status = ?");
      args.push(statusFilter);
    }

    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      where.push("(pname LIKE ? OR pcat LIKE ?)");
      args.push(pattern, pattern);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const result = await client.execute({
      sql: `SELECT * FROM products ${whereClause} ORDER BY preg DESC`,
      args,
    });

    res.status(200).send({ error: false, details: result.rows || [] });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true, message: "Failed to fetch products" });
  }
};

const adminDeleteProduct = async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req, res);
    if (!adminUser) return;

    const productId = normalizeProductId(req.body?.productId);
    if (!productId) {
      return res.status(400).send({ error: true, message: "Invalid productId" });
    }
    const client = getTursoClient();
    const product = await getProductById(productId);
    if (!product) {
      return res.status(404).send({ error: true, message: "Product not found" });
    }

    await client.execute({
      sql: "DELETE FROM bid_entries WHERE bid_id IN (SELECT id FROM bids WHERE product_id = ?)",
      args: [productId],
    });
    await client.execute({ sql: "DELETE FROM bids WHERE product_id = ?", args: [productId] });
    await client.execute({ sql: "DELETE FROM messages WHERE product_id = ?", args: [productId] });
    await client.execute({ sql: "DELETE FROM products WHERE id = ?", args: [productId] });

    res.status(200).send({ error: false, message: "Product deleted" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true, message: "Failed to delete product" });
  }
};

const addbid = async (req, res) => {
  try {
    const client = getTursoClient();
    const { biddata } = req.body;
    let bidDataFromDB = await getBidForProduct(biddata.pid);
    const buyer = await getUserById(biddata.buyerId);
    if (!buyer) {
      return res.status(404).send({ error: true, message: "Buyer not found" });
    }

    const reg = (buyer.mail || "").slice(0, 6);

    if (!bidDataFromDB) {
      const bidId = crypto.randomUUID();
      await client.execute({
        sql: `INSERT INTO bids (id, product_id, seller_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          bidId,
          biddata.pid,
          biddata.sellerId,
          toSqliteDatetime(new Date()),
          toSqliteDatetime(new Date()),
        ],
      });
      bidDataFromDB = { id: bidId };
    }

    await client.execute({
      sql: `INSERT INTO bid_entries (id, bid_id, buyer_id, bid_price, bid_time, regno, cancelled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        crypto.randomUUID(),
        bidDataFromDB.id,
        biddata.buyerId,
        biddata.bidPrice,
        toSqliteDatetime(biddata.bidTime || new Date()),
        reg,
        toSqliteDatetime(new Date()),
        toSqliteDatetime(new Date()),
      ],
    });

    const dataFromdb = await getBidForProduct(biddata.pid);
    res.status(200).send({ details: { bid: toLegacyBidPayload(dataFromdb) } });
  } catch (err) {
    console.log("Error in addbid:", err);
    res.status(500).send({ error: true, message: "Failed to add bid" });
  }
};

const removebid = async (req, res) => {
  try {
    const client = getTursoClient();
    const { productid, buyerId } = req.body;
    const bid = await getBidForProduct(productid);
    if (!bid) {
      return res.status(200).send({ error: false, details: { bid: null } });
    }

    await client.execute({
      sql: "DELETE FROM bid_entries WHERE bid_id = ? AND buyer_id = ?",
      args: [bid.id, buyerId],
    });

    const updatedBid = await getBidForProduct(productid);
    res.status(200).send({ error: false, details: { bid: toLegacyBidPayload(updatedBid) } });
  } catch (error) {
    console.log(error);
    res.status(302).send({ error: true });
  }
};

const confirmdeal = async (req, res) => {
  try {
    const client = getTursoClient();
    const { productid, sellerid, mail, productname, bprice } = req.body;
    const sellerinfo = await getUserById(sellerid);
    if (!sellerinfo) {
      return res.status(404).send({ error: true, message: "Seller not found" });
    }

    await client.execute({
      sql: "DELETE FROM bid_entries WHERE bid_id IN (SELECT id FROM bids WHERE product_id = ?)",
      args: [productid],
    });
    await client.execute({ sql: "DELETE FROM bids WHERE product_id = ?", args: [productid] });
    await client.execute({ sql: "DELETE FROM messages WHERE product_id = ?", args: [productid] });
    await client.execute({ sql: "DELETE FROM products WHERE id = ?", args: [productid] });

    const text = `Hi, I am ${sellerinfo.name}, and I look forward to fixing the deal of ${productname} for ₱${bprice}.\nYou can find my contact details attached here\nAddress: ${sellerinfo.address}\nPhone  : ${sellerinfo.phone}\nEmail  : ${sellerinfo.mail}`;
    await sendEmail(mail, "Confirm Deal", text);
    res.status(200).send({ error: false });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true });
  }
};

const cancelnotification = async (req, res) => {
  try {
    const client = getTursoClient();
    const { prodid, bid } = req.body;
    const targetBid = await getBidForProduct(prodid);
    if (!targetBid) {
      return res.status(200).send({ allNotifications: [] });
    }

    await client.execute({
      sql: "UPDATE bid_entries SET cancelled = 1, updated_at = ? WHERE bid_id = ? AND buyer_id = ?",
      args: [toSqliteDatetime(new Date()), targetBid.id, bid],
    });

    const result = await client.execute({
      sql: `SELECT b.product_id, b.seller_id, p.pimage, p.pname, be.buyer_id, be.bid_price, be.cancelled, u.name AS buyer_name
            FROM bids b
            JOIN bid_entries be ON be.bid_id = b.id
            JOIN products p ON p.id = b.product_id
            LEFT JOIN users u ON u.id = be.buyer_id
            WHERE b.seller_id = ?
            ORDER BY be.bid_time DESC`,
      args: [targetBid.seller_id],
    });

    const findata = (result.rows || [])
      .filter((row) => !fromBoolInt(row.cancelled))
      .map((row) => ({
        prodId: row.product_id,
        href: `/buy-product/${row.product_id}/${row.seller_id}/${row.buyer_id}`,
        imageURL: row.pimage,
        reg: row.buyer_name,
        pname: row.pname,
        bprice: row.bid_price,
        cancel: false,
        bid: row.buyer_id,
      }));

    res.status(200).send({ allNotifications: findata });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true });
  }
};

const deletemybid = async (req, res) => {
  try {
    const client = getTursoClient();
    const { pid, bid } = req.body;
    const biddata = await getBidForProduct(pid);
    if (!biddata) {
      return res.status(200).send({ error: false });
    }

    await client.execute({
      sql: "DELETE FROM bid_entries WHERE bid_id = ? AND buyer_id = ?",
      args: [biddata.id, bid],
    });

    res.status(200).send({ error: false });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true });
  }
};

const acceptbid = async (req, res) => {
  try {
    const client = getTursoClient();
    const { prodId, buyer, bprice } = req.body;
    await client.execute({
      sql: "UPDATE products SET sold = 1, sold_to = ?, sold_price = ?, updated_at = ? WHERE id = ?",
      args: [buyer, bprice, toSqliteDatetime(new Date()), prodId],
    });

    const bidDoc = await getBidForProduct(prodId);
    if (bidDoc) {
      await client.execute({
        sql: "UPDATE bid_entries SET cancelled = 1, updated_at = ? WHERE bid_id = ? AND buyer_id <> ?",
        args: [toSqliteDatetime(new Date()), bidDoc.id, buyer],
      });
    }

    const buyerUser = await getUserById(buyer);
    if (!buyerUser) {
      return res.status(400).send({ error: true, message: "Buyer not found" });
    }

    res.status(200).send({ 
      success: true, 
      message: "Bid accepted and product marked as sold",
      buyerEmail: buyerUser.mail
    });
  } catch (error) {
    console.log("Error in acceptbid:", error);
    res.status(400).send({ error: true, message: "Failed to accept bid" });
  }
};

const rejectbid = async (req, res) => {
  try {
    const client = getTursoClient();
    const { prodId, buyer } = req.body;
    
    if (!prodId || !buyer) {
      console.log("Missing parameters:", { prodId, buyer });
      return res.status(400).send({ error: true, message: "Missing required parameters" });
    }

    const bidDoc = await getBidForProduct(prodId);
    if (!bidDoc) {
      return res.status(404).send({ error: true, message: "Bid not found" });
    }

    await client.execute({
      sql: "DELETE FROM bid_entries WHERE bid_id = ? AND buyer_id = ?",
      args: [bidDoc.id, buyer],
    });
    
    res.status(200).send({ 
      success: true, 
      message: "Bid rejected successfully"
    });
  } catch (error) {
    console.log("Error in rejectbid:", error);
    res.status(400).send({ error: true, message: "Failed to reject bid" });
  }
};

// Send a message
const sendMessage = async (req, res) => {
  try {
    const { productId, senderId, receiverId, message, imageData } = req.body;
    const cleanedMessage = String(message || "").trim();

    if (!productId || !senderId || !receiverId) {
      return res.status(400).send({ error: true, message: "Missing required fields" });
    }

    if (!cleanedMessage && !imageData) {
      return res.status(400).send({ error: true, message: "Message text or image is required" });
    }

    if (imageData) {
      const isDataUrlImage = /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(String(imageData));
      if (!isDataUrlImage) {
        return res.status(400).send({ error: true, message: "Invalid image format" });
      }

      const imageSizeInBytes = getDataUrlByteSize(String(imageData));
      if (imageSizeInBytes > MAX_CHAT_IMAGE_BYTES) {
        return res.status(413).send({
          error: true,
          message: "Chat image size must be 5MB or less",
        });
      }
    }

    await saveMessageDb({
      productId,
      senderId,
      receiverId,
      message: cleanedMessage,
      imageData: imageData || null,
    });

    res.status(200).send({ error: false, message: "Message sent successfully" });
  } catch (error) {
    console.log("Error sending message:", error);
    res.status(400).send({ error: true, message: "Failed to send message" });
  }
};

// Get messages for a conversation
const getMessages = async (req, res) => {
  try {
    const client = getTursoClient();
    const { productId, userId, otherUserId } = req.body;

    if (!productId || !userId || !otherUserId) {
      return res.status(400).send({ error: true, message: "Missing required fields" });
    }

    const result = await client.execute({
      sql: `SELECT m.*, su.name AS sender_name, ru.name AS receiver_name
            FROM messages m
            LEFT JOIN users su ON su.id = m.sender_id
            LEFT JOIN users ru ON ru.id = m.receiver_id
            WHERE m.product_id = ?
              AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
            ORDER BY m.timestamp ASC`,
      args: [productId, userId, otherUserId, otherUserId, userId],
    });

    await markMessagesAsRead(productId, userId, otherUserId);

    const messages = (result.rows || []).map((row) => ({
      _id: row.id,
      productId: row.product_id,
      senderId: {
        _id: row.sender_id,
        name: row.sender_name,
      },
      receiverId: {
        _id: row.receiver_id,
        name: row.receiver_name,
      },
      message: row.message,
      imageData: row.image_data || null,
      timestamp: row.timestamp,
      read: fromBoolInt(row.is_read),
    }));

    res.status(200).send({ error: false, messages });
  } catch (error) {
    console.log("Error getting messages:", error);
    res.status(400).send({ error: true, message: "Failed to get messages" });
  }
};

// Get all chat conversations for a user
const getChatList = async (req, res) => {
  try {
    const client = getTursoClient();
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send({ error: true, message: "User ID required" });
    }

    const result = await client.execute({
      sql: `SELECT m.*, p.pname, p.pimage,
                   su.name AS sender_name, ru.name AS receiver_name
            FROM messages m
            LEFT JOIN products p ON p.id = m.product_id
            LEFT JOIN users su ON su.id = m.sender_id
            LEFT JOIN users ru ON ru.id = m.receiver_id
            WHERE m.sender_id = ? OR m.receiver_id = ?
            ORDER BY m.timestamp DESC`,
      args: [userId, userId],
    });

    const conversationsMap = new Map();

    for (const msg of result.rows || []) {
      if (!msg.sender_id || !msg.receiver_id || !msg.product_id) {
        continue;
      }

      const otherUserId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      const otherUserName = msg.sender_id === userId ? msg.receiver_name : msg.sender_name;
      const key = `${msg.product_id}_${otherUserId}`;

      if (!conversationsMap.has(key)) {
        const unreadResult = await client.execute({
          sql: `SELECT COUNT(*) AS count
                FROM messages
                WHERE product_id = ? AND receiver_id = ? AND sender_id = ? AND is_read = 0`,
          args: [msg.product_id, userId, otherUserId],
        });

        const unreadCount = Number(unreadResult.rows?.[0]?.count || 0);

        conversationsMap.set(key, {
          productId: msg.product_id,
          productName: msg.pname,
          productImage: msg.pimage,
          otherUserId,
          otherUserName,
          lastMessage: (msg.message && msg.message.trim()) || (msg.image_data ? "Sent an image" : ""),
          lastMessageTime: msg.timestamp,
          unreadCount,
        });
      }
    }

    const conversations = Array.from(conversationsMap.values());
    res.status(200).send({ error: false, conversations });
  } catch (error) {
    console.log("Error getting chat list:", error);
    res.status(400).send({ error: true, message: "Failed to get chat list" });
  }
};

// Request password reset - send OTP to email
const requestPasswordReset = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);

    if (!normalizedEmail) {
      return res.status(400).send({ error: true, message: "Email is required" });
    }

    console.log("Password reset request for email:", normalizedEmail);

    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      console.log("User not found for email:", normalizedEmail);
      return res.status(404).send({ error: true, message: "Email not found" });
    }

    console.log("User found, generating OTP for:", user.mail);

    // Generate OTP for password reset
    await deleteOtpsForUser(user.id, "password-reset");
    const code = generateOtpCode();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await createOtp(user.id, codeHash, expiresAt, "password-reset");

    // Send email with OTP
    const emailText = `Your password reset code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`;
    let emailSent = true;
    try {
      await sendEmail(user.mail, "Password Reset Code", emailText);
    } catch (err) {
      emailSent = false;
      console.log("Password reset email send failed", err?.message || err);
    }

    // Dev fallback: log OTP to console
    if (process.env.NODE_ENV !== "production") {
      console.log(`DEV PASSWORD RESET OTP for ${user.mail}: ${code}`);
    }

    // Issue a temporary reset token
    const resetToken = jwt.sign(
      { _id: user.id, stage: "reset-password", email: user.mail },
      process.env.JWTPRIVATEKEY,
      { expiresIn: "12m" }
    );

    res.status(200).send({
      error: false,
      message: "Reset code sent to email",
      resetToken,
      devOtp: process.env.NODE_ENV !== "production" ? code : undefined,
    });
  } catch (error) {
    console.log("Error requesting password reset:", error);
    res.status(400).send({ error: true, message: "Failed to request password reset" });
  }
};

// Verify reset code
const verifyResetCode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).send({ error: true, message: "Reset code is required" });
    }

    const resetToken = req.headers.authorization?.split(" ")[1];
    if (!resetToken) {
      return res.status(401).send({ error: true, message: "Reset token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWTPRIVATEKEY);
    } catch {
      return res.status(401).send({ error: true, message: "Invalid or expired reset token" });
    }

    const user = await findUserById(decoded._id);
    if (!user) {
      return res.status(404).send({ error: true, message: "User not found" });
    }

    // Verify OTP
    const otpDoc = await findValidOtpForUser(user.id, "password-reset");
    if (!otpDoc) {
      return res.status(400).send({ error: true, message: "No valid reset code found" });
    }

    const isValid = verifyOtpCode(code, otpDoc.codeHash);
    if (!isValid) {
      return res.status(400).send({ error: true, message: "Invalid reset code" });
    }

    // Mark OTP as verified (will be deleted after password reset)
    res.status(200).send({
      error: false,
      message: "Reset code verified successfully",
    });
  } catch (error) {
    console.log("Error verifying reset code:", error);
    res.status(400).send({ error: true, message: "Failed to verify reset code" });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).send({ error: true, message: "New password is required" });
    }

    if (newPassword.length < 8 || newPassword.length > 16) {
      return res.status(400).send({ error: true, message: "Password must be 8-16 characters" });
    }

    const resetToken = req.headers.authorization?.split(" ")[1];
    if (!resetToken) {
      return res.status(401).send({ error: true, message: "Reset token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWTPRIVATEKEY);
    } catch {
      return res.status(401).send({ error: true, message: "Invalid or expired reset token" });
    }

    const user = await findUserById(decoded._id);
    if (!user) {
      return res.status(404).send({ error: true, message: "User not found" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.SALT));

    // Update password
    await updateUserPassword(user.id, hashedPassword);

    // Delete all OTPs for this user
    await deleteAllOtpsForUser(user.id);

    // Send confirmation email
    const emailText = "Your password has been successfully reset.";
    try {
      await sendEmail(user.mail, "Password Reset Successful", emailText);
    } catch (err) {
      console.log("Confirmation email send failed", err?.message || err);
    }

    res.status(200).send({
      error: false,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.log("Error resetting password:", error);
    res.status(400).send({ error: true, message: "Failed to reset password" });
  }
};

const renewListing = async (req, res) => {
  try {
    const { pid, token } = req.body;
    const user = await getUserFromRefreshToken(token);
    if (!user) {
      return res.status(401).send({ error: true, message: "Not authenticated" });
    }

    const product = await getProductById(pid);
    if (!product) {
      return res.status(404).send({ error: true, message: "Product not found" });
    }

    // Only the seller or an admin may renew
    if (
      user.role !== "admin" &&
      (product.seller_id || product.id)?.toString() !== (user.id || user._id)?.toString()
    ) {
      return res.status(403).send({ error: true, message: "Not authorized" });
    }

    const newExpiresAt = new Date(
      Date.now() + LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );
    await updateProduct(pid, { expires_at: newExpiresAt });

    res.status(200).send({
      error: false,
      message: `Listing renewed for ${LISTING_EXPIRY_DAYS} days`,
      expiresAt: newExpiresAt,
    });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true, message: "Failed to renew listing" });
  }
};

const setSellerTrust = async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req, res);
    if (!adminUser) return;

    const { userId, sellerVerified, sellerRating, sellerRatingCount } = req.body;
    if (!userId) {
      return res.status(400).send({ error: true, message: "userId is required" });
    }

    const updates = {};
    if (typeof sellerVerified === "boolean") {
      updates.seller_verified = toBoolInt(sellerVerified);
    }
    if (sellerRating !== undefined) {
      const numericRating = Number(sellerRating);
      if (Number.isNaN(numericRating) || numericRating < 0 || numericRating > 5) {
        return res.status(400).send({ error: true, message: "sellerRating must be between 0 and 5" });
      }
      updates.seller_rating = numericRating;
    }
    if (sellerRatingCount !== undefined) {
      const numericCount = Number(sellerRatingCount);
      if (!Number.isInteger(numericCount) || numericCount < 0) {
        return res.status(400).send({ error: true, message: "sellerRatingCount must be a non-negative integer" });
      }
      updates.seller_rating_count = numericCount;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).send({ error: true, message: "No valid fields to update" });
    }

    const existingUser = await getUserById(userId);
    if (!existingUser) {
      return res.status(404).send({ error: true, message: "User not found" });
    }

    await updateUser(userId, updates);
    const updatedUser = await getUserById(userId);

    res.status(200).send({
      error: false,
      details: {
        id: updatedUser.id,
        name: updatedUser.name,
        mail: updatedUser.mail,
        sellerVerified: fromBoolInt(updatedUser.seller_verified),
        sellerRating: Number(updatedUser.seller_rating || 0),
        sellerRatingCount: Number(updatedUser.seller_rating_count || 0),
      },
    });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true, message: "Failed to update seller trust" });
  }
};

module.exports = {
  prodData,
  deletemybid,
  login,
  verifyOtp,
  resendOtp,
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
  logout,
  register,
  verifyRegisterOtp,
  resendRegisterOtp,
  verify,
  token,
  delToken,
  profile,
  delAcc,
  update,
  displayProd,
  getVerifiedShops,
  searchproduct,
  sell,
  getPendingProducts,
  approveProduct,
  rejectProduct,
  renewListing,
  setSellerTrust,
  getAdminAllProducts,
  adminDeleteProduct,
  addbid,
  removebid,
  fixdeal,
  deletemyprod,
  confirmdeal,
  cancelnotification,
  acceptbid,
  rejectbid,
  sendMessage,
  getMessages,
  getChatList,
};
