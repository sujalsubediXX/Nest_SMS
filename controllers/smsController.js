import mongoose from "mongoose";
import Wallet from "../models/wallet.model.js";
import Message from "../models/message.model.js";
import countPart from "../utils/sms.js";
import getProvider from "../providers/index.js";
import Provider from "../models/provider.model.js";

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

    // Only the pending -> failed transition is allowed to refund credits.
    await refundMessage(msg);
}
async function refundMessage(msg) {
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
export async function sendSMS(req, res) {
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

export async function getLogs(req, res) {
    const userId = req.userId;
    const filter = { userId };
    const { status, date, number, from, to } = req.query;

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);

    if (status) {
        if (!["pending", "sent", "failed"].includes(status.toLowerCase())) {
            return res.status(400).json({ error: "Invalid status filter" });
        }
        filter.status = status;
    }
    if (number) {
        const normalized = normalizeNumber(number);
        if (!normalized) {
            return res.status(400).json({ error: "Invalid number filter" });
        }
        filter.to = normalized;
    }
    if (date) {
        const start = new Date(`${date}T00:00:00.000Z`);
        if (isNaN(start))
            return res.status(400).json({ error: "date must be YYYY-MM-DD" });
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);
        filter.createdAt = { $gte: start, $lt: end };
    } else if (from || to) {
        filter.createdAt = {};
        if (from) {
            const f = new Date(from);
            if (isNaN(f))
                return res.status(400).json({ error: "Invalid `from` date" });
            filter.createdAt.$gte = f;
        }
        if (to) {
            const t = new Date(to);
            if (isNaN(t)) return res.status(400).json({ error: "Invalid `to` date" });
            filter.createdAt.$lte = t;
        }
    }

    const [total, logs] = await Promise.all([
        Message.countDocuments(filter),
        Message.find(filter)
            .sort({ createdAt: -1 }) // newest first
            .skip((page - 1) * limit)
            .limit(limit)
            .select("-__v"),
    ]);

    res.json({
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        data: logs,
    });
}


export async function getRoutesHealth(req, res) {
    const hour = 24;
    const success_weight = 0.8
    const balance_weight = 0.2
    const low_balance_threshold = 100

    const since = new Date(Date.now() - hour * 60 * 60 * 1000);

    const stats = await Message.aggregate([
        { $unwind: "$attempts" },
        { $match: { createdAt: { $gte: since } } },
        {
            $group: {
                _id: "$attempts.route",
                total: { $sum: 1 },
                success: { $sum: { $cond: ["$attempts.success", 1, 0] } },
            }
        },
    ])



    const statsByRoute = Object.fromEntries(stats.map(s => [s._id, s]));

    const providers = await Provider.find().sort({ priority: 1 });
    const routes = providers.map((p) => {
        const s = statsByRoute[p.name];
        const total = s ? s.total : 0;
        const success = s ? s.success : 0;
        const successRate = total > 0 ? success / total : 1;

        const balanceScore = Math.min(p.balance / low_balance_threshold, 1)

        const health = p.balance <= 0 ? 0 : total == 0 ? 1 : success_weight * successRate + balance_weight * balanceScore

        return {
            route: p.name,
            priority: p.priority,
            balance: p.balance,
            attemptsLast24h: total,
            successRate: total === 0 ? null : Math.round(successRate * 100),
            health: Math.round(health * 100),

        };
    });

    res.json({ routes });
}