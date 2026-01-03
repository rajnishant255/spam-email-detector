// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

// 1. Middlewares
app.use(cors());
app.use(express.json());

// 2. Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/spamdetector";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// 3. Mongoose model
const spamCheckSchema = new mongoose.Schema({
  text: { type: String, required: true },
  result: { type: String, required: true },          // "spam" or "not_spam"
  spamProbability: { type: Number, required: true }, // 0–1
  matchedKeywords: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});

const SpamCheck = mongoose.model("SpamCheck", spamCheckSchema);

// 4. Simple spam keyword “AI”
const SPAM_KEYWORDS = [
  "free",
  "win",
  "winner",
  "prize",
  "congratulations",
  "click here",
  "lottery",
  "cash",
  "urgent",
  "offer",
  "limited time",
  "buy now"
];

function analyzeSpam(text) {
  const lower = text.toLowerCase();
  const matched = [];

  SPAM_KEYWORDS.forEach((word) => {
    if (lower.includes(word)) {
      matched.push(word);
    }
  });

  const score = matched.length;
  const probability = Math.min(1, score / 5); // 0–1
  const result = probability >= 0.5 ? "spam" : "not_spam";

  return { result, probability, matchedKeywords: matched };
}

// 5. Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false, // for 587
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// ✅ STEP 3: Verify SMTP connection when server starts
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP error:", error.message);
  } else {
    console.log("✅ SMTP server is ready to send emails");
  }
});

// helper to send alert email
async function sendAlertEmail({ toEmail, text, probability, matchedKeywords }) {
  const percent = Math.round(probability * 100);

  const mailOptions = {
    from: process.env.MAIL_FROM,
    to: toEmail || process.env.ALERT_DEFAULT_TO,
    subject: `[Spam Alert] ${percent}% spam detected`,
    text: `
We detected a spammy message.

Spam score: ${percent}%
Keywords: ${matchedKeywords.length ? matchedKeywords.join(", ") : "none"}

Message:
------------------------------------------------
${text}
------------------------------------------------
    `.trim()
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("📧 Email sent:", info.messageId);
}

// 6. Routes
app.get("/", (req, res) => {
  res.send("Spam Detector API is running 🚀");
});

// POST /api/spam/check
app.post("/api/spam/check", async (req, res) => {
  try {
    const { text, notifyEmail } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Text is required" });
    }

    const { result, probability, matchedKeywords } = analyzeSpam(text);

    const doc = await SpamCheck.create({
      text,
      result,
      spamProbability: probability,
      matchedKeywords
    });

    // send email only if:
    // 1) user provided email OR use default
    // 2) spam >= 40%
    const shouldNotify = (notifyEmail || process.env.ALERT_DEFAULT_TO) &&
                         probability * 100 >= 40;

    if (shouldNotify) {
      try {
        await sendAlertEmail({
          toEmail: notifyEmail,
          text,
          probability,
          matchedKeywords
        });
      } catch (mailErr) {
        console.error("❌ Error sending alert email:", mailErr.message);
      }
    }

    res.json({
      id: doc._id,
      result,
      spamProbability: probability,
      matchedKeywords,
      createdAt: doc.createdAt
    });
  } catch (err) {
    console.error("Error in /api/spam/check:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/spam/history
app.get("/api/spam/history", async (req, res) => {
  try {
    const docs = await SpamCheck.find().sort({ createdAt: -1 }).limit(10);

    res.json(
      docs.map((d) => ({
        id: d._id,
        result: d.result,
        spamProbability: d.spamProbability,
        matchedKeywords: d.matchedKeywords,
        text: d.text.length > 80 ? d.text.slice(0, 77) + "..." : d.text,
        createdAt: d.createdAt
      }))
    );
  } catch (err) {
    console.error("Error in /api/spam/history:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 7. Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
