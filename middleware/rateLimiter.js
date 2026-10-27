import rateLimit from "express-rate-limit";

const smsLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute window
  max: 60,               // 60 requests per window
  keyGenerator: (req) => String(req.userId), // limit per user, not per IP
  standardHeaders: true, // sends RateLimit-* headers
  legacyHeaders: false,
  message: { error: "Too many requests. Try again in a minute." },
});

export default smsLimiter;