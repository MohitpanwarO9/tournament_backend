require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRouter = require("./routes/auth");
const tournamentRouter = require("./routes/tournament");

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(",").map((x) => x.trim())
    : true,
  credentials: false
}));
app.use(express.json({ limit: "50kb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "tournament-backend" });
});

app.use("/api/auth", authRouter);
app.use("/api/tournament", tournamentRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: "Internal server error.",
    detail: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Tournament backend running on http://localhost:${port}`);
});
