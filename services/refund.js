import mongoose from "mongoose";
import Wallet from "../models/wallet.model.js";
import Message from "../models/message.model.js";

export default async function refundMessage(msg) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // only the first caller flips pending -> failed
      const updated = await Message.findOneAndUpdate(
        { _id: msg._id, status: "pending" },
        { status: "failed" },
        { session }
      );
      if (!updated) return; // already handled, do NOT refund again

      await Wallet.updateOne(
        { userId: msg.userId },
        { $inc: { credits: msg.cost } },
        { session }
      );
    });
  } finally {
    session.endSession();
  }
}