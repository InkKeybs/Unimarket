const jwt = require("jsonwebtoken");
const { createUserToken, deleteUserToken } = require("../db/sqlHelpers");

const generateTokens = async (user) => {
  try {
    // Handle both MongoDB (_id) and SQL (id) fields
    const userId = user._id || user.id;
    const payload = { _id: userId, role: user.role };
    const accessToken = jwt.sign(payload, process.env.JWTPRIVATEKEY, {
      expiresIn: "14m",
    });
    const refreshToken = jwt.sign(payload, process.env.JWTREFRESHPRIVATEKEY, {
      expiresIn: "30d",
    });

    // Use SQL helper to save refresh token
    await createUserToken(userId, refreshToken);
    
    return Promise.resolve({ accessToken, refreshToken });
  } catch (err) {
    return Promise.reject(err);
  }
};

module.exports = generateTokens;
