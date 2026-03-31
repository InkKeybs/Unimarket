const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const jwt = require("jsonwebtoken");

const UserSchema = new Schema({
  name: { type: String, required: true },
  mail: { type: String, required: true },
  year: { type: Number, required: true },
  address: { type: String, required: true },
  phone: { type: Number, required: true },
  password: { type: String, required: true },
  course: { type: String, required: false },
  verified: { type: Boolean, default: false },
  sellerVerified: { type: Boolean, default: false },
  sellerRating: { type: Number, default: 0, min: 0, max: 5 },
  sellerRatingCount: { type: Number, default: 0, min: 0 },
  verificationExpiresAt: { type: Date, default: null },
  role: { type: String, default: "user", required: true },
});

// Auto-delete only unverified users once verification window expires.
UserSchema.index(
  { verificationExpiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: {
      verified: false,
      verificationExpiresAt: { $type: "date" },
    },
  }
);

UserSchema.methods.generateAuthToken = () => {
  const token = jwt.sign({ _id: this._id }, process.env.JWTPRIVATEKEY, {
    expiresIn: "30d",
  });
  return token;
};

const User = mongoose.model("User", UserSchema, "users");

UserSchema.methods.generateAuthToken = async function () {
  try {
    const token = jwt.sign({ _id: this._id }, process.env.JWTPRIVATEKEY);
    return token;
  } catch (error) {
    console.log(error);
  }
};

module.exports = User;
