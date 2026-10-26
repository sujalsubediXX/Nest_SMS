import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
  const authorization = req.headers.authorization;
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authorization required." });
  }

  try {
    req._id = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};
