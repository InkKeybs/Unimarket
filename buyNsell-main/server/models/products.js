const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const productSchema = new Schema({
  id: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  pname: {
    type: String,
    required: true,
  },
  pprice: {
    type: Number,
    requried: true,
  },
  pdetail: {
    type: String,
    requried: true,
  },
  pdate: {
    type: Date,
    required: true,
  },
  pimage: {
    type: String,
  },
  pcat: {
    type: String,
    requried: true,
  },
  preg: {
    type: Date,
    default: Date.now,
  },
  sold: {
    type: Boolean,
    default: false,
  },
  soldTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  soldPrice: {
    type: Number,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  approvedAt: {
    type: Date,
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  rejectedAt: {
    type: Date,
  },
  rejectedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  expiresAt: {
    type: Date,
  },
});

const Product = mongoose.model("Product", productSchema, "products");
module.exports = Product;
