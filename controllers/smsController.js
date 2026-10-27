import mongoose from "mongoose";
import Wallet from "../models/wallet.model.js";
import Message from "../models/message.model.js";
import countPart from "../utils/sms.js";
import getProvider from "../providers/index.js";

function normalizeNumber(input) {
  let n = String(input).trim().replace(/[\s-]/g, "");

  if (n.startsWith("+977")) n = n.slice(4);
  else if (n.startsWith("977") && n.length === 13) n = n.slice(3);

  return /^9[78]\d{8}$/.test(n) ? n : null; // 10 digits, starts with 97 or 98
}




async function deliver(msg, providers) {
  for (const provider of providers) {
    if ((await provider.getBalance()) < msg.parts) continue; // skip routes without balance

    try {
      await provider.send(msg.to, msg.parts);
      await Message.updateOne(
        { _id: msg._id },
        {
          status: "sent",
          provider: provider.name,
          $push: { attempts: { route: provider.name, success: true } },
        },
      );
      return; // done
    } catch (err) {
      await Message.updateOne(
        { _id: msg._id },
        { $push: { attempts: { route: provider.name, success: false } } },
      );
      // loop continues to the next provider
    }
  }

  // every route failed: mark failed and refund (Part A.6)
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Message.updateOne(
        { _id: msg._id },
        { status: "failed" },
        { session },
      );
      await Wallet.updateOne(
        { userId: msg.userId },
        { $inc: { credits: msg.cost } },
        { session },
      );
    });
  } finally {
    session.endSession();
  }
}

export  async function sendSMS(req, res) {
  const userId = req.userId;
  const { to, message } = req.body;

  if (!Array.isArray(to) || to.length == 0) {
    return res.status(400).json({ error: "'to' must me non empty array" });
  }

  if (!message || typeof message !== "string" || message.length == 0) {
    return res
      .status(400)
      .json({ error: "'message' must be a non-empty string" });
  }

  const numbers = [];
  const invalidNumbers = [];
  for (const num of to) {
    const normalized = normalizeNumber(num);
    normalized ? numbers.push(normalized) : invalidNumbers.push(num);
  }

  if (invalidNumbers.length) {
    return res.status(400).json({
      error:
        "Invalid phone numbers. Must be 10 digits starting with 97 or 98 (optional +977/977 prefix).",
      invalid: invalidNumbers,
    });
  }

  const { totalParts, encoding } = countPart(message);
  const totalCost = totalParts * numbers.length;

  const session = await mongoose.startSession();
  let messages;
  try {
    await session.withTransaction(async () => {
      const wallet = await Wallet.findOneAndUpdate(
        { userId: userId, credits: { $gte: totalCost } },
        { $inc: { credits: -totalCost } },
        { returnDocument: "after", session },
      );
      if (!wallet) {
        const err = new Error("Insufficient credits");
        err.code = "INSUFFICIENT_CREDITS";
        throw err; // throwing aborts the transaction
      }

      messages = await Message.insertMany(
        numbers.map((num) => ({
          userId,
          to: num,
          text: message,
          parts: totalParts,
          cost: totalParts,
          status: "pending",
        })),
        { session },
      );
    });
  } catch (err) {
    if (err.code === "INSUFFICIENT_CREDITS") {
      return res.status(402).json({
        error: "Insufficient credits",
        required: totalCost,
      });
    }
    throw err;
  } finally {
    session.endSession();
  }

  const providers = await getProvider();
  for (const msg of messages) {
    await deliver(msg, providers);
  }

  // 6. respond
  const final = await Message.find({
    _id: { $in: messages.map((m) => m._id) },
  });
  res.status(200).json({
    encoding,
    partsPerMessage: totalParts,
    totalCost,
    results: final.map((m) => ({
      to: m.to,
      status: m.status,
      provider: m.provider,
    })),
  });
}


export  async function getLogs(req, res) {
  const userId = req.userId;
  const {status , date, number} = req.query;

  const page = Math.max(parseInt(req.query.page ) || 1 ,1)
  const limit = Math.min(Math.max(parseInt(re.query.limit) || 10, 1),100)

  if(status && !["pending", "sent", "failed"].includes(status.toLowerCase())){
    return res.status(400).json({error:"Invalid status filter"})
  }
  if(number ){
    const normalized = normalizeNumber(number);
    if(!normalized){
      return res.status(400).json({error:"Invalid number filter"})
    }
  }

  
}