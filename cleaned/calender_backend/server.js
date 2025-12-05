// server.js  — final version for Railway + MySQL

require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend from /public (this is your index.html)
app.use(express.static("public"));

// ===== DATABASE CONNECTION POOL =====
const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  connectionLimit: 10,
});

// Simple health check
app.get("/health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, db: rows[0].ok });
  } catch (err) {
    console.error("Healthcheck error:", err);
    res.status(500).json({ ok: false, error: "DB error" });
  }
});

// ===== API: GLOBAL STATS (this was already working) =====
app.get("/api/stats", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM closures)   AS closures,
        (SELECT COUNT(*) FROM events)     AS events,
        (SELECT COUNT(*) FROM sports)     AS sports,
        (SELECT COUNT(*) FROM occupancy)  AS occupancy
    `);

    res.json(rows[0]);
  } catch (error) {
    console.error("Error in /api/stats:", error);
    res.status(500).json({ error: "Error fetching stats" });
  }
});

// ===== API: MONTH DATA WITH COUNTS (DRIVES CALENDAR DOTS) =====
app.get("/api/month", async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: "Missing year or month" });
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (Number.isNaN(y) || Number.isNaN(m)) {
      return res.status(400).json({ error: "Invalid year or month" });
    }

    // date_key like 20200501 … 20200531
    const startKey = y * 10000 + m * 100 + 1;
    const lastDay = new Date(y, m, 0).getDate(); // last day of that month
    const endKey = y * 10000 + m * 100 + lastDay;

    const [rows] = await pool.query(
      `
      SELECT
        d.date_key,
        d.date,
        (SELECT COUNT(*) FROM events            e WHERE e.date_key = d.date_key) AS event_count,
        (SELECT COUNT(*) FROM academic_calendar ac WHERE ac.date_key = d.date_key) AS academic_count,
        (SELECT COUNT(*) FROM sports            s WHERE s.date_key = d.date_key) AS sport_count,
        (SELECT COUNT(*) FROM closures          c WHERE c.date_key = d.date_key) AS closure_count,
        (SELECT COUNT(*) FROM occupancy         o WHERE o.date_key = d.date_key) AS occupancy_count,
        (SELECT COUNT(*) FROM weather           w WHERE w.date_key = d.date_key) AS weather_count
      FROM dates d
      WHERE d.date_key BETWEEN ? AND ?
      ORDER BY d.date_key
      `,
      [startKey, endKey]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error in /api/month:", error);
    res.status(500).json({ error: "Could not load month data" });
  }
});

// ===== API: DATE DETAILS (RIGHT-SIDE PANEL) =====
app.get("/api/date/:date_key", async (req, res) => {
  try {
    const dateKey = parseInt(req.params.date_key, 10);
    if (Number.isNaN(dateKey)) {
      return res.status(400).json({ error: "Invalid date_key" });
    }

    const [[dateRow]] = await pool.query(
      "SELECT date_key, date FROM dates WHERE date_key = ?",
      [dateKey]
    );

    const [events]    = await pool.query(
      "SELECT * FROM events WHERE date_key = ?",
      [dateKey]
    );
    const [academic]  = await pool.query(
      "SELECT * FROM academic_calendar WHERE date_key = ?",
      [dateKey]
    );
    const [sports]    = await pool.query(
      "SELECT * FROM sports WHERE date_key = ?",
      [dateKey]
    );
    const [closures]  = await pool.query(
      "SELECT * FROM closures WHERE date_key = ?",
      [dateKey]
    );
    const [occupancy] = await pool.query(
      "SELECT * FROM occupancy WHERE date_key = ?",
      [dateKey]
    );
    const [[weather]] = await pool.query(
      "SELECT * FROM weather WHERE date_key = ?",
      [dateKey]
    );

    res.json({
      date_key: dateKey,
      date: dateRow ? dateRow.date : null,
      events,
      academic,
      sports,
      closures,
      occupancy,
      weather,
    });
  } catch (error) {
    console.error("Error in /api/date:", error);
    res.status(500).json({ error: "Error loading date details" });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
