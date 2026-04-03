require("dotenv").config();
const express = require("express");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const { validateData } = require("../utils/validation");
const authRouter = express.Router();
const admin = require("../utils/firebaseAdmin");

authRouter.post("/signup", async (req, res) => {
  try {
    validateData(req);
    const { name, email, password, gender } = req.body;

    // 🔹 Check if the email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }
    const hashPassword = await bcrypt.hash(password, 10);
    // console.log(hashPassword);

    // create a new instance of user model
    const user = new User({
      name,
      password: hashPassword,
      email,
      gender,
    });

    const savedUser = await user.save(); // Save the user to the database

    // Generate a JWT token
    const token = await savedUser.getJWT(); // Removed unnecessary `await` as `getJWT()` is synchronous
    // console.log(token);
    // Set the cookie with the token
    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // 🔥 REQUIRED (HTTPS)
      sameSite: "None", // 🔥 REQUIRED (cross-domain)
      path: "/", // ✅ good practice
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    res.json({
      message: "User created successfully",
      data: savedUser,
    });
  } catch (error) {
    console.error("Error saving user:", error.message);
    res.status(500).send("Failed to save user data.");
  }
});
authRouter.post("/google-signup", async (req, res) => {
  try {
    const { name, email, idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: "Missing idToken" });
    }

    // 🔥 Verify the idToken
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const firebaseEmail = decodedToken.email;

    // Double-check email matches
    if (firebaseEmail !== email) {
      return res.status(400).json({ message: "Email mismatch" });
    }

    // Check if the email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Create a new user instance
    const user = new User({
      name,
      email,
    });

    // Save the user to the database
    const savedUser = await user.save();

    // Generate a JWT token
    const token = await savedUser.getJWT();

    // Set the cookie with the token
    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // 🔥 REQUIRED (HTTPS)
      sameSite: "None", // 🔥 REQUIRED (cross-domain)
      path: "/", // ✅ good practice
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Respond with success message and user data
    res.json({
      message: "User created successfully",
      data: savedUser,
    });
  } catch (error) {
    console.error("Error saving user:", error.message);
    res.status(500).send("Failed to save user data.");
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).send("Email and password are required");
    }

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Compare the provided password with the hashed password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).send("Invalid email or password");
    }

    // Generate a JWT token
    const token = await user.getJWT(); // Removed unnecessary `await` as `getJWT()` is synchronous
    // console.log(token);
    // Set the cookie with the token
    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // 🔥 REQUIRED (HTTPS)
      sameSite: "None", // 🔥 REQUIRED (cross-domain)
      path: "/", // ✅ good practice
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Successful login
    return res.status(200).send(user);
  } catch (error) {
    console.error("Error during login:", error.message);

    // Handle unexpected errors
    return res.status(500).send("Internal server error");
  }
});
authRouter.post("/google-login", async (req, res) => {
  try {
    const { idToken } = req.body;

    // ✅ Verify Google ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const email = decodedToken.email; // Extract email from the decoded token

    if (!email) throw new Error("Invalid token");

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Generate a JWT token
    const token = await user.getJWT(); // Removed unnecessary `await` as `getJWT()` is synchronous

    // Set the cookie with the token
    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // 🔥 REQUIRED (HTTPS)
      sameSite: "None", // 🔥 REQUIRED (cross-domain)
      path: "/", // ✅ good practice
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    // Successful login
    return res.status(200).send(user);
  } catch (error) {
    console.error("Error during login:", error.message);

    // Handle unexpected errors
    return res.status(500).send("Internal server error");
  }
});

authRouter.post("/logout", async (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
    expires: new Date(0), // immediately expire
  });

  res.send("Logout successful");
});

module.exports = authRouter;
