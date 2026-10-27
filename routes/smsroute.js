import Router from "express";
import { sendSMS, getLogs,getRoutesHealth } from "../controllers/smsController.js";
import { requireAuth } from "../middleware/auth.js";
import smsLimiter from "../middleware/rateLimiter.js";
const router = Router();
router.post("/sms/send", requireAuth, smsLimiter, sendSMS);
router.get("/sms/logs", requireAuth, getLogs);
router.get("/routes/health", requireAuth, getRoutesHealth);
export default router;