const mongoose = require("mongoose");

const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(process.env.DB_URL);
    console.log(`MongoDB connected with server: ${conn.connection.host}`);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
  }
};

module.exports = connectDatabase;
