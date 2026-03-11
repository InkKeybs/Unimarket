const buyNsellRouter = require("./routes/buyNsell");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

mongoose.set("strictQuery", false);
require("dotenv").config();
app.use(express.urlencoded({ extended: false }));
if (process.env.ATLAS_KEY) {
  mongoose
    .connect(`${process.env.ATLAS_KEY}`)
    .then(() => console.log("connected to db"))
    .catch((err) => console.log("DB connection error:", err));
} else {
  console.log("ATLAS_KEY not set — skipping MongoDB connection. Set ATLAS_KEY in .env to connect to your database.");
}

const PORT = process.env.PORT || 5000;

app.use("/api", buyNsellRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
