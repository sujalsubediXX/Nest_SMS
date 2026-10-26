import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  phoneNumber:{
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function (v) {
        return /^9[78]\d{8}$/.test(v);
      },
      message: "Phone number must be a valid Nepal number",
    },
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
},{ timestamps: true,});

export default mongoose.model("User", userSchema);
