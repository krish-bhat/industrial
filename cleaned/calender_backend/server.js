require("dotenv").config();
const path = require("path");
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();

// Allow API calls from browser
app.use(cors());
app.use(express.json());

// Serve static files (your website) from /public
app.use(express.static(path.join(__dirname, "public")));

// ===== DATABASE CONNECTION POOL =====
const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  connectionLimit: 10,
});

// ===== HOME PAGE =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== API: GLOBAL STATS =====
app.get("/api/stats", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM closures)  AS closures,
        (SELECT COUNT(*) FROM events)    AS events,
        (SELECT COUNT(*) FROM sports)    AS sports,
        (SELECT COUNT(*) FROM occupancy) AS occupancy
    `);

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching stats" });
  }
});

// ===== API: MONTH DATA =====
app.get("/api/month", async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) {
    return res.status(400).json({ error: "Missing year or month" });
  }

  const start = `${year}-${month}-01`;
  const end = `${year}-${month}-31`;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM dates WHERE date BETWEEN ? AND ?",
      [start, end]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load month data" });
  }
});

// ===== API: DATE DETAILS =====
app.get("/api/date/:date_key", async (req, res) => {
  try {
    const dateKey = req.params.date_key;
    const [rows] = await pool.query(
      "SELECT * FROM date_tags WHERE date_key = ?",
      [dateKey]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error loading date details" });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
