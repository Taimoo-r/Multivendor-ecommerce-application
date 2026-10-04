// Sign the user in: set the auth cookie and return the user (never the password hash).
const sendToken = (user, statusCode, res) => {
  const token = user.getJwtToken();

  const options = {
    expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };

  const safe = user.toObject();
  delete safe.password;

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    user: safe,
  });
};

module.exports = sendToken;
