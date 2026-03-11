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
  role: { type: String, default: "user", required: true },
});

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
