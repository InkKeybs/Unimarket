const { getUserTokenByToken, getUserById } = require("../db/sqlHelpers");
const jwt = require("jsonwebtoken");

const verifyRefreshToken = async (refreshToken) => {
  const privateKey = process.env.JWTREFRESHPRIVATEKEY;
  return new Promise(async (resolve, reject) => {
    try {
      const tokenFound = await getUserTokenByToken(refreshToken);
      if (!tokenFound) return reject({ error: true, message: "NOT FOUND" });
      
      jwt.verify(refreshToken, privateKey, async (err, tokenDetails) => {
        if (err) {
          return reject({ error: false, message: "Invalid refresh token" });
        }
        
        // Get full user details to include in token
        const userId = tokenDetails._id || tokenDetails.id;
        const user = await getUserById(userId);
        
        resolve({
          tokenDetails: {
            ...tokenDetails,
            role: user?.role || 'user'
          },
          error: false,
          message: "Valid refresh token",
        });
      });
    } catch (error) {
      reject({ error: true, message: "Error verifying token" });
    }
  });
};

module.exports = verifyRefreshToken;
