// Sign the seller in: set the seller cookie and return the shop (never the password hash).
const sendShopToken = (shop, statusCode, res) => {
  const token = shop.getJwtToken();

  const options = {
    expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };

  const safe = shop.toObject();
  delete safe.password;

  res.status(statusCode).cookie("seller_token", token, options).json({
    success: true,
    user: safe,
  });
};

module.exports = sendShopToken;
