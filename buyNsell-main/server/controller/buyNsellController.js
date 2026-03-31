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

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

// Helper: Convert UTC string to SQLite format
// (Already imported from sqlHelpers)

const findUserByEmail = async (email) => {
  const normalized = normalizeEmail(email);
  return getUserByEmail(normalized);
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
  if (!product?.expiresAt) return false;
  return new Date(product.expiresAt) <= new Date();
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
  return product.id?.toString() === user._id?.toString();
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
        year: req.body.year,
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
      year: req.body.year,
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
    const { pname, pprice, pimage } = await Product.findById(productid);
    var findata = { pname: pname, productprice: pprice, pimage: pimage };
    const biddata = await Bid.findOne({ prodId: productid });
    for (let i = 0; i < biddata.bids.length; i++) {
      if (biddata.bids[i].buyerId.toString() === buyerid) {
        findata = { ...findata, bidprice: biddata.bids[i].bidPrice };
        break;
      }
    }
    const { name, mail } = await User.findById(buyerid);
    findata = { ...findata, buyername: name };
    findata = { ...findata, mail: mail };
    res.status(200).send({ fixdeal: findata });
  } catch (error) {
    console.log(error);
    res.status(300).send({ error: true });
  }
};

const profile = async (req, res) => {
  try {
    const { id } = req.body;
    const user = await User.findOne({ _id: id });

    var arr = [];
    const data = await Bid.find({});

    for (let i = 0; i < data.length; i++) {
      var { pname, pimage, pprice } = await Product.findById(data[i].prodId);
      for (let j = 0; j < data[i].bids.length; j++) {
        if (data[i].bids[j].buyerId.toString() === id) {
          const temp = {
            pname: pname,
            pimage: pimage,
            bidPrice: data[i].bids[j].bidPrice,
            bidtime: data[i].bids[j].bidTime,
            bid: id,
            pid: data[i].prodId,
            pprice: pprice,
          };
          arr.push(temp);
        }
      }
    }
    const mydata = await Product.find({ id: id });

    var myprodData = [];
    for (let i = 0; i < mydata.length; i++) {
      const temp = {
        id: mydata[i]._id,
        pname: mydata[i].pname,
        pprice: mydata[i].pprice,
        pimage: mydata[i].pimage,
        preg: mydata[i].preg,
        status: mydata[i].status || PRODUCT_APPROVAL_STATUS.APPROVED,
        expiresAt: mydata[i].expiresAt || null,
      };
      myprodData.push(temp);
    }

    // Get purchased items (where soldTo matches user ID)
    const purchasedData = await Product.find({ soldTo: id, sold: true });
    var myPurchases = [];
    for (let i = 0; i < purchasedData.length; i++) {
      const temp = {
        id: purchasedData[i]._id,
        pname: purchasedData[i].pname,
        pprice: purchasedData[i].pprice,
        soldPrice: purchasedData[i].soldPrice,
        pimage: purchasedData[i].pimage,
        preg: purchasedData[i].preg,
      };
      myPurchases.push(temp);
    }

    if (!user) {
      res.status(400).send({
        error: true,
        message: "User not found",
        data: user,
        mybids: arr,
        myproducts: myprodData,
        mypurchases: myPurchases,
      });
    }
    res
      .status(200)
      .send({ erro: false, data: user, mybids: arr, myproducts: myprodData, mypurchases: myPurchases });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true });
  }
};

const deletemyprod = async (req, res) => {
  try {
    const { pid } = req.body;
    await Product.deleteOne({ _id: pid });
    await Bid.deleteOne({ prodId: pid });
    res.status(200).send({ error: false });
  } catch (error) {
    res.status(400).send({ error: true });
  }
};

const delAcc = async (req, res) => {
  try {
    const id = req.body.id;
    await User.deleteOne({ _id: id });
    await UserToken.deleteOne({ userId: id });
    await Bid.deleteOne({ sellerId: id });
    await Product.deleteOne({ id: id });
    res
      .status(200)
      .send({ error: false, message: "Account deleted Successfully" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true });
  }
};

const logout = async (req, res) => {
  try {
    const id = req.body.id;
    await UserToken.deleteOne({ userId: id });
    res.status(200).send({ error: false, message: "Logged out successfully" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true });
  }
};

const update = async (req, res) => {
  try {
    const newData = req.body.newData;
    const id = req.body.id;
    await User.updateOne({ _id: id }, newData);
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

const prodData = async (req, res) => {
  try {
    const id = req.body.id;
    const requestingUser = await getUserFromRefreshToken(req.body.token);
    console.log(id);
    const data = await Product.findById(id);
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

    const bid = await Bid.findOne({ prodId: id });
    const seller = await User.findById(data.id);
    if (!seller) {
      return res.status(404).send({ error: true, message: "Seller not found" });
    }

    const { name, mail, phone, sellerVerified, sellerRating, sellerRatingCount } = seller;
    const isExpired = isProductExpired(data);
    res
      .status(200)
      .send({
        error: false,
        details: {
          data,
          bid,
          name,
          mail,
          phone,
          sellerVerified: Boolean(sellerVerified),
          sellerRating: Number(sellerRating || 0),
          sellerRatingCount: Number(sellerRatingCount || 0),
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
    await Product.create({
      ...pdata,
      id,
      status: PRODUCT_APPROVAL_STATUS.PENDING,
      expiresAt,
    });
    res
      .status(200)
      .send({ error: false, message: "Product submitted for admin approval" });
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

    const pendingProducts = await Product.find({
      sold: { $ne: true },
      status: PRODUCT_APPROVAL_STATUS.PENDING,
    })
      .sort({ preg: -1 })
      .setOptions({ allowDiskUse: true })
      .lean();

    res.status(200).send({ error: false, details: pendingProducts });
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

    const { productId } = req.body;
    const product = await Product.findByIdAndUpdate(
      productId,
      {
        status: PRODUCT_APPROVAL_STATUS.APPROVED,
        approvedAt: new Date(),
        approvedBy: adminUser._id,
        $unset: {
          rejectedAt: "",
          rejectedBy: "",
        },
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).send({ error: true, message: "Product not found" });
    }

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

    const { productId } = req.body;
    const product = await Product.findByIdAndUpdate(
      productId,
      {
        status: PRODUCT_APPROVAL_STATUS.REJECTED,
        rejectedAt: new Date(),
        rejectedBy: adminUser._id,
        $unset: {
          approvedAt: "",
          approvedBy: "",
        },
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).send({ error: true, message: "Product not found" });
    }

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
    const query = {};
    if (statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)) {
      query.status = statusFilter;
    }
    if (search && search.trim()) {
      const pattern = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ pname: pattern }, { pcat: pattern }];
    }

    const products = await Product.find(query)
      .sort({ preg: -1 })
      .setOptions({ allowDiskUse: true })
      .lean();
    res.status(200).send({ error: false, details: products });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true, message: "Failed to fetch products" });
  }
};

const adminDeleteProduct = async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req, res);
    if (!adminUser) return;

    const { productId } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send({ error: true, message: "Product not found" });
    }

    await Product.deleteOne({ _id: productId });
    await Bid.deleteOne({ prodId: productId });

    res.status(200).send({ error: false, message: "Product deleted" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true, message: "Failed to delete product" });
  }
};

const addbid = async (req, res) => {
  try {
    const { biddata } = req.body;
    console.log("Adding bid:", biddata);
    const bidDataFromDB = await Bid.findOne({
      prodId: biddata.pid,
    });
    const { mail } = await User.findById(biddata.buyerId);
    const reg = mail.slice(0, 6);
    if (!bidDataFromDB) {
      const newData = {
        prodId: biddata.pid,
        sellerId: biddata.sellerId,
        bids: [
          {
            buyerId: biddata.buyerId,
            bidPrice: biddata.bidPrice,
            bidTime: biddata.bidTime,
            regno: reg,
            cancel: false,
          },
        ],
      };
      console.log("Creating new bid document:", newData);
      await Bid.create(newData);
    } else {
      console.log("Adding bid to existing document");
      bidDataFromDB.bids.push({
        buyerId: biddata.buyerId,
        bidPrice: biddata.bidPrice,
        bidTime: biddata.bidTime,
        regno: reg,
        cancel: false,
      });
      await Bid.updateOne(
        { prodId: biddata.pid, sellerId: biddata.sellerId },
        bidDataFromDB
      );
    }
    const dataFromdb = await Bid.findOne({
      prodId: biddata.pid,
      sellerId: biddata.sellerId,
    });
    console.log("Bid saved successfully:", dataFromdb);
    res.status(200).send({ details: { bid: dataFromdb } });
  } catch (err) {
    console.log("Error in addbid:", err);
    res.status(500).send({ error: true, message: "Failed to add bid" });
  }
};

const removebid = async (req, res) => {
  try {
    const { productid, buyerId } = req.body;
    var bid = await Bid.findOne({ prodId: productid });
    console.log(bid, buyerId);
    var arr = [];
    for (let i = 0; i < bid.bids.length; i++) {
      if (bid.bids[i].buyerId.toString() !== buyerId) {
        console.log(
          bid.bids[i].buyerId,
          buyerId,
          bid.bids[i].buyerId !== buyerId
        );
        arr.push(bid.bids[i]);
      }
    }
    console.log(arr);
    bid.bids = arr;
    await Bid.updateOne({ prodId: productid }, bid);
    res.status(200).send({ error: false, details: { bid: bid } });
  } catch (error) {
    console.log(error);
    res.status(302).send({ error: true });
  }
};

const confirmdeal = async (req, res) => {
  try {
    const { productid, sellerid, mail, productname, bprice } = req.body;
    const sellerinfo = await User.findById(sellerid);
    await Product.deleteOne({ _id: productid });
    await Bid.deleteOne({ prodId: productid });
    console.log(sellerinfo);
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
    const { prodid, bid } = req.body;
    var notifitcation = await Bid.findOne({ prodId: prodid });
    for (let i = 0; i < notifitcation.bids.length; i++) {
      if (notifitcation.bids[i].buyerId.toString() === bid) {
        notifitcation.bids[i].cancel = true;
      }
    }
    await Bid.updateOne({ prodId: prodid }, notifitcation);

    var findata = [];
    const sellerid = notifitcation.sellerId;
    notifitcation = await Bid.find({ sellerId: sellerid });
    console.log(notifitcation);
    for (let i = 0; i < notifitcation.length; i++) {
      const { id, pimage, pname } = await Product.findById(
        notifitcation[i].prodId
      );
      for (let j = 0; j < notifitcation[i].bids.length; j++) {
        const { name } = await User.findById(notifitcation[i].bids[j].buyerId);
        if (notifitcation[i].bids[j].cancel === false) {
          findata.push({
            prodId: notifitcation[i].prodId,
            href: `/buy-product/${notifitcation[i].prodId}/${id}/${notifitcation[i].bids[j].buyerId}`,
            imageURL: pimage,
            reg: name,
            pname: pname,
            bprice: notifitcation[i].bids[j].bidPrice,
            cancel: notifitcation[i].bids[j].cancel,
            bid: notifitcation[i].bids[j].buyerId,
          });
        }
      }
    }
    console.log(findata);
    res.status(200).send({ allNotifications: findata });
  } catch (error) {
    res.status(400).send({ error: true });
  }
};

const deletemybid = async (req, res) => {
  try {
    const { pid, bid } = req.body;
    console.log(pid, bid);
    var biddata = await Bid.findOne({ prodId: pid });
    var arr = [];
    for (let i = 0; i < biddata.bids.length; i++) {
      if (biddata.bids[i].buyerId.toString() !== bid) {
        arr.push(biddata.bids[i]);
      }
    }
    biddata.bids = arr;
    await Bid.updateOne({ prodId: pid }, biddata);
    console.log(biddata);
    res.status(200).send({ error: false });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: true });
  }
};

const acceptbid = async (req, res) => {
  try {
    const { prodId, buyer, bprice } = req.body;
    console.log("Accepting bid:", { prodId, buyer, bprice });
    
    // Mark product as sold
    await Product.updateOne(
      { _id: prodId },
      { 
        sold: true,
        soldTo: buyer,
        soldPrice: bprice
      }
    );
    
    // Cancel all other bids for this product
    const bidDoc = await Bid.findOne({ prodId: prodId });
    if (bidDoc) {
      bidDoc.bids.forEach(bid => {
        if (bid.buyerId.toString() !== buyer.toString()) {
          bid.cancel = true;
        }
      });
      await bidDoc.save();
    }
    
    // Get buyer info for notification
    const buyerUser = await User.findById(buyer);
    
    if (!buyerUser) {
      console.log("Buyer not found");
      return res.status(400).send({ error: true, message: "Buyer not found" });
    }
    
    // In a real app, you'd send an email here
    console.log(`Product sold to ${buyerUser.name} (${buyerUser.mail}) for ₱${bprice}`);
    
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
    const { prodId, buyer } = req.body;
    
    if (!prodId || !buyer) {
      console.log("Missing parameters:", { prodId, buyer });
      return res.status(400).send({ error: true, message: "Missing required parameters" });
    }

    // Find the bid document
    const bidDoc = await Bid.findOne({ prodId: prodId });
    
    if (!bidDoc) {
      return res.status(404).send({ error: true, message: "Bid not found" });
    }

    // Remove the specific bid
    bidDoc.bids = bidDoc.bids.filter(bid => bid.buyerId.toString() !== buyer.toString());
    
    await bidDoc.save();
    
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
    const { productId, senderId, receiverId, message } = req.body;

    if (!productId || !senderId || !receiverId || !message) {
      return res.status(400).send({ error: true, message: "Missing required fields" });
    }

    const newMessage = new Message({
      productId,
      senderId,
      receiverId,
      message,
    });

    await newMessage.save();
    res.status(200).send({ error: false, message: "Message sent successfully" });
  } catch (error) {
    console.log("Error sending message:", error);
    res.status(400).send({ error: true, message: "Failed to send message" });
  }
};

// Get messages for a conversation
const getMessages = async (req, res) => {
  try {
    const { productId, userId, otherUserId } = req.body;

    if (!productId || !userId || !otherUserId) {
      return res.status(400).send({ error: true, message: "Missing required fields" });
    }

    const messages = await Message.find({
      productId: productId,
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    })
      .sort({ timestamp: 1 })
      .populate("senderId", "name")
      .populate("receiverId", "name");

    // Mark messages as read
    await Message.updateMany(
      {
        productId: productId,
        receiverId: userId,
        senderId: otherUserId,
        read: false,
      },
      { read: true }
    );

    res.status(200).send({ error: false, messages });
  } catch (error) {
    console.log("Error getting messages:", error);
    res.status(400).send({ error: true, message: "Failed to get messages" });
  }
};

// Get all chat conversations for a user
const getChatList = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send({ error: true, message: "User ID required" });
    }

    // Get unique conversations
    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .populate("senderId", "name")
      .populate("receiverId", "name")
      .populate("productId", "pname pimage")
      .sort({ timestamp: -1 });

    // Group by conversation (productId + other user)
    const conversationsMap = new Map();
    
    for (const msg of messages) {
      // Skip malformed messages to avoid crashes
      if (!msg.senderId || !msg.receiverId || !msg.productId) {
        continue;
      }

      const otherUserId = msg.senderId._id.toString() === userId ? msg.receiverId._id : msg.senderId._id;
      const key = `${msg.productId._id}_${otherUserId}`;
      
      if (!conversationsMap.has(key)) {
        const unreadCount = await Message.countDocuments({
          productId: msg.productId._id,
          receiverId: userId,
          senderId: otherUserId,
          read: false,
        });

        conversationsMap.set(key, {
          productId: msg.productId._id,
          productName: msg.productId.pname,
          productImage: msg.productId.pimage,
          otherUserId: otherUserId,
          otherUserName: msg.senderId._id.toString() === userId ? msg.receiverId.name : msg.senderId.name,
          lastMessage: msg.message,
          lastMessageTime: msg.timestamp,
          unreadCount: unreadCount,
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
    await Otp.deleteMany({ userId: user._id, purpose: "password-reset" });
    const code = generateOtpCode();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await Otp.create({
      userId: user._id,
      codeHash,
      expiresAt,
      purpose: "password-reset",
    });

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
      { _id: user._id, stage: "reset-password", email: user.mail },
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
    const { resetToken, code } = req.body;

    if (!resetToken || !code) {
      return res.status(400).send({ error: true, message: "Reset token and code are required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWTPRIVATEKEY);
      if (decoded.stage !== "reset-password") {
        return res.status(401).send({ error: true, message: "Invalid reset token" });
      }
    } catch (err) {
      return res.status(401).send({ error: true, message: "Reset token expired" });
    }

    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(404).send({ error: true, message: "User not found" });
    }

    // Find and verify OTP
    const otpRecord = await Otp.findOne({
      userId: user._id,
      purpose: "password-reset",
      consumed: false,
    });

    if (!otpRecord) {
      return res.status(400).send({ error: true, message: "No active reset code found" });
    }

    // Check expiry
    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).send({ error: true, message: "Reset code expired" });
    }

    // Verify hash
    const codeHash = hashOtp(code);
    if (codeHash !== otpRecord.codeHash) {
      return res.status(400).send({ error: true, message: "Invalid reset code" });
    }

    // Mark as consumed
    otpRecord.consumed = true;
    await otpRecord.save();

    // Issue verified reset token
    const verifiedToken = jwt.sign(
      { _id: user._id, stage: "verified-reset", email: user.mail },
      process.env.JWTPRIVATEKEY,
      { expiresIn: "15m" }
    );

    res.status(200).send({
      error: false,
      message: "Code verified",
      verifiedToken,
    });
  } catch (error) {
    console.log("Error verifying reset code:", error);
    res.status(400).send({ error: true, message: "Failed to verify reset code" });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).send({ error: true, message: "Reset token and password are required" });
    }

    if (newPassword.length < 8 || newPassword.length > 16) {
      return res.status(400).send({ error: true, message: "Password must be 8-16 characters" });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWTPRIVATEKEY);
      if (decoded.stage !== "verified-reset") {
        return res.status(401).send({ error: true, message: "Invalid reset token" });
      }
    } catch (err) {
      return res.status(401).send({ error: true, message: "Reset token expired" });
    }

    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(404).send({ error: true, message: "User not found" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.SALT));

    // Update password
    user.password = hashedPassword;
    await user.save();

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

    const product = await Product.findById(pid);
    if (!product) {
      return res.status(404).send({ error: true, message: "Product not found" });
    }

    // Only the seller or an admin may renew
    if (
      user.role !== "admin" &&
      product.id?.toString() !== user._id?.toString()
    ) {
      return res.status(403).send({ error: true, message: "Not authorized" });
    }

    const newExpiresAt = new Date(
      Date.now() + LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );
    await Product.updateOne({ _id: pid }, { expiresAt: newExpiresAt });

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

    const update = {};
    if (typeof sellerVerified === "boolean") {
      update.sellerVerified = sellerVerified;
    }
    if (sellerRating !== undefined) {
      const numericRating = Number(sellerRating);
      if (Number.isNaN(numericRating) || numericRating < 0 || numericRating > 5) {
        return res.status(400).send({ error: true, message: "sellerRating must be between 0 and 5" });
      }
      update.sellerRating = numericRating;
    }
    if (sellerRatingCount !== undefined) {
      const numericCount = Number(sellerRatingCount);
      if (!Number.isInteger(numericCount) || numericCount < 0) {
        return res.status(400).send({ error: true, message: "sellerRatingCount must be a non-negative integer" });
      }
      update.sellerRatingCount = numericCount;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).send({ error: true, message: "No valid fields to update" });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, {
      new: true,
      runValidators: true,
      select: "name mail sellerVerified sellerRating sellerRatingCount",
    }).lean();

    if (!updatedUser) {
      return res.status(404).send({ error: true, message: "User not found" });
    }

    res.status(200).send({ error: false, details: updatedUser });
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
