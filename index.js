import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import router from "./routes/routes.js";
import connectDB from "./utils/db.js";
import {requireAuth} from "./middleware/auth.js";
dotenv.config();
import Provider from "./models/provider.module.js";
const app = express();
app.use(express.json());
app.use(cors());
app.use("/", router);
app.get("/test", requireAuth, (req, res) => {
  const id = req._id; // Access the user ID from the request object
  res.json({ message: "Test route accessed successfully.", userId: id });
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
Providers()


const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server started at port ${PORT}`);
  });
};

startServer()
