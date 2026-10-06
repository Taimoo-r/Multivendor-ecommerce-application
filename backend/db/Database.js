const dns = require("dns");
const mongoose = require("mongoose");

// Some networks refuse the SRV lookups Atlas needs; DNS_SERVERS=1.1.1.1,8.8.8.8 works around it.
const useCustomDns = () => {
  if (process.env.DNS_SERVERS) {
    dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));
  }
};

const connectDatabase = async () => {
  useCustomDns();
  try {
    // Index builds on a live collection are run deliberately (npm run migrate), not on boot.
    const conn = await mongoose.connect(process.env.DB_URL, {
      autoIndex: process.env.NODE_ENV !== "production",
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 10_000,
    });
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    // no point serving an API without its database; let the process manager restart us
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

module.exports = connectDatabase;
module.exports.useCustomDns = useCustomDns;
