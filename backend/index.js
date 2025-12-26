const express = require("express");
const cors = require("cors");
require("dotenv").config();

const signPdfRoute = require("./routes/signPdf");

const mongoose = require("mongoose");

mongoose.set("bufferCommands", false);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Atlas connected");
  })
  .catch((err) => {
    console.error("MongoDB Atlas connection error:", err);
  });

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "10mb" }));

app.use("/uploads", express.static("uploads"));

app.use("/sign-pdf", signPdfRoute);
const PORT = 5001;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});