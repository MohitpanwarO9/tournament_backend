const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { requireAdmin } = require("../middleware/auth");

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
      Buffer.from(suppliedHash, "utf8"),
    );
  });

  if (!valid) {
    return res.status(401).json({ error: "Wrong password." });
  }

  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "12h",
  });

  res.json({ token, role: "admin" });
});

router.get("/check", async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      // console.log("urning null")
      return res.status(452).json({message : "not admin"});
    }
    const check = jwt.verify(token, process.env.JWT_SECRET);
    // console.log(check);
    if(check.role === "admin"){
      return res.status(200).json({message : "yes admin"});
    }
    
  } catch (err) {
    return res.status(452).json({message: "not admin"});
  }
});

module.exports = router;
