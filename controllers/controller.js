import jwt from "jsonwebtoken";
import User from "../models/user.module.js";
import mongoose from "mongoose";
import Wallet from "../models/wallet.module.js";

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
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = createToken(user);
    return res.status(200).json({ message: "Login successful.", token });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ error: "Unable to log in." });
  }
};

const validatePhoneNumber = (phoneNumber) => {
  let number = phoneNumber.trim();

  if (phoneNumber.startsWith("+977")) {
    number = number.slice(4); // remove the +977
  } else if (phoneNumber.startsWith("977") && phoneNumber.length === 13) {
    number = number.slice(3); // remove the 977
  }

  if (!/^\d{10}$/.test(number)) {
    return {
      valid: false,
      error: "Phone number must contain exactly 10 digits and must be number",
    };
  }
 if (!/^9[78]/.test(number)) {
    return {
      valid: false,
      error: "Phone number must start with 97 or 98",
    };
  }

   return {
      valid: true,
      number: number,
    };
};



export const register = async (req, res) => {
  try {
    const { name, email, phoneNumber, password } = req.body;

    if (!name || !email || !phoneNumber || !password) {
      return res.status(400).json({
        error: "Name, email, phone number and password are required.",
      });
    }

    const validatedPhoneNumber = validatePhoneNumber(phoneNumber);
    if (!validatedPhoneNumber.valid) {
      return res.status(400).json({ error: validatedPhoneNumber.error });
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
              phoneNumber: validatedPhoneNumber.number,
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
      return res.status(409).json({ error: "Email is already registered." });
    }
    return res.status(500).json({ error: "Unable to register user." });
  }
};

export { requireAuth };
