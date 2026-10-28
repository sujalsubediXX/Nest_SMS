import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import mongoose from "mongoose";
import Wallet from "../models/wallet.model.js";

import bcrypt from "bcryptjs";
import { requireAuth } from "../middleware/auth.js";


const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: "3d",
  });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email ) {
      return res
        .status(400)
        .json({ error: "Email is required." });
    }
    if (!password) {
      return res
        .status(400)
        .json({ error: "Password is required." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user ) {
      return res.status(401).json({ error: "Invalid email or User does not exist." });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    const token = createToken(user);
    return res.status(200).json({ message: "Login successful.", token });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ error: "Unable to log in." });
  }
};



export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email  || !password) {
      return res.status(400).json({
        error: "Name, email and password are required.",
      });
    }


    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    let user;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // array form is required when passing { session } to create()
        [user] = await User.create(
          [
            {
              name: name.trim(),
              email: email.trim().toLowerCase(),
              password: hashedPassword,
            },
          ],
          { session }
        );

        await Wallet.create([{ userId: user._id, credits: 100 }], { session });
      });
    } finally {
      session.endSession();
    }

    const token = createToken(user); 
    return res
      .status(201)
      .json({ message: "User registered successfully.", token });
  } catch (error) {
    console.error("Registration failed:", error);
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern ?? {})[0];

      if (duplicateField === "email") {
        return res.status(409).json({ error: "Email is already registered." });
      }

      console.error("Registration duplicate key:", error.keyValue);
      return res.status(409).json({
        error: "A registration record already exists.",
      });
    }
    return res.status(500).json({ error: "Unable to register user." });
  }
};

export { requireAuth };
