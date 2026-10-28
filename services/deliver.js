import Message from "../models/message.model.js";
import refundMessage from "./refund.js";
import getProvider from "../providers/index.js";

export default async function deliver(msg, providers) {
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
            return; 
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