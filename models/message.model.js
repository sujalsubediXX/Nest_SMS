import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    to: {
      type: String,
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    parts: {
      type: Number,
      required: true,
    },
    cost: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
      index: true,
    },
    provider: {
      type: String,
    },
     attempts: [
      {
        route: String,
        success: Boolean,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

messageSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
