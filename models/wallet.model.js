import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    credits: {
        type: Number,
        default: 0,
    },

},{ timestamps: true});

export default mongoose.model("Wallet", walletSchema);