const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bidSchema = new Schema({
  prodId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  sellerId: {
    type: Schema.Types.ObjectId,
  },
  bids: Array({
    buyerId: { type: Schema.Types.ObjectId },
    bidPrice: { type: Number },
    bidTime: { type: Date },
    regno: { type: String },
    cancel: { type: Boolean },
  }),
});

const Bid = mongoose.model("Bid", bidSchema, "bid");

module.exports = Bid;
