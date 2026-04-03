require("dotenv").config(); // Load environment variables
const mongoose = require("mongoose");
var validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minLength: 8,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Invalid email");
        }
      },
    },
    password: {
      type: String,
      validate: (value) => {
        if (!validator.isStrongPassword(value)) {
          throw new Error("Password must be strong");
        }
      },
    },
    gender: {
      type: String,
      validate(value) {
        if (!["Male", "Female", "Other"].includes(value)) {
          throw new Error("Invalid gender");
        }
      },
    },
    PhotoUrl: {
      type: String,
    },
    skills: {
      type: [String],
      validate(value) {
        if (value.length > 10) {
          throw new Error("Skills cannot be more than 10");
        }
      },
    },
    description: {
      type: String,
    },
    location: {
      type: String,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    membershipType: {
      type: String,
    },
    fcmToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// these are the schema method to bycrypt.compare and for creating jwt token;

userSchema.methods.getJWT = async function () {
  const user = this;
  const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
  return token;
};

userSchema.methods.validatePassword = async function (passwordInputByUser) {
  const user = this;
  const hashedPassword = user.password;
  const isValidPassword = await bcrypt.compare(
    passwordInputByUser,
    hashedPassword
  );
  return isValidPassword;
};

// double Ensuring unique index for email at the database level
// userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);

module.exports = User;
