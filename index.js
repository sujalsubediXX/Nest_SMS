import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import userrouter from "./routes/user.route.js";
import smsRouter from "./routes/sms.route.js";
import connectDB from "./utils/db.js";
import { requireAuth } from "./middleware/auth.js";
dotenv.config();
import Provider from "./models/provider.model.js";
const app = express();
app.use(express.json());
app.use(cors());
app.use("/", userrouter);
app.use("/", smsRouter);

app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must contain valid JSON" });
  }
  next(error);
});


const PORT = process.env.PORT || 3000;

const Providers = async () => {
  try {
    const existingProviders = await Provider.find();
    if (existingProviders.length === 0) {
      await Provider.insertMany([
        { name: "ROUTE_A", priority: 1, balance: 1000, failureRate: 0.3 },
        { name: "ROUTE_B", priority: 2, balance: 1000, failureRate: 0.1 },
        { name: "ROUTE_C", priority: 3, balance: 1000, failureRate: 0.05 },
      ]);
    }
  } catch (error) {
    console.error("Error seeding providers:", error);
  }
};
const startServer = async () => {
  await connectDB();
  await Providers();
  app.listen(PORT, () => {
    console.log(`Server started at port ${PORT}`);
  });
};

startServer()
