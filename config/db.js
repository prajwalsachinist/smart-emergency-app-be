const mongoose = require("mongoose");

async function connectDB() {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error("MongoDB connection failed: MONGO_URI is not set in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoURI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

module.exports = connectDB;
