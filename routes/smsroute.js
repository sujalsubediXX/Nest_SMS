import Router from "express";
import { sendSMS, getLogs } from "../controllers/smsController.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();
router.post("/sms/send", requireAuth, sendSMS);
router.get("/sms/logs", requireAuth, getLogs);
export default router;