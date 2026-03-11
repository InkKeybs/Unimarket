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
app.use(cors());

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

// Bind to localhost only to prevent exposing the dev server on the LAN.
// This makes the server listen on 127.0.0.1 only.
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server is running at http://127.0.0.1:${PORT}`);
});
