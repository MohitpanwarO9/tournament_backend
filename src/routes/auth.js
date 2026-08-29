const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const router = express.Router();

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

router.post("/login", (req, res) => {
  const { password } = req.body || {};
  // console.log(password);
  if (typeof password !== "string" || !password.trim()) {
    return res.status(400).json({ error: "Password is required." });
  }

  // Temporary compatibility with the existing frontend's SHA-256 hash.
  // Replace ADMIN_PASSWORD_HASHES with your own hash(es) in .env.
  const configured = (process.env.ADMIN_PASSWORD_HASHES || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const suppliedHash = sha256(password.trim());

  const valid = configured.some((expected) => {
    if (expected.length !== suppliedHash.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(suppliedHash, "utf8")
    );
  });

  if (!valid) {
    return res.status(401).json({ error: "Wrong password." });
  }

  const token = jwt.sign(
    { role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
  );

  res.json({ token, role: "admin" });
});

module.exports = router;
