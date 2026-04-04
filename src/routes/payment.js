const express = require("express");
const paymentRouter = express.Router();
const { authUser } = require("../middleware/authuser");
const instance = require("../utils/razorpay");
const Payment = require("../models/payment");
const membershipAmount = require("../utils/constant");
const User = require("../models/user");
const { sendEmail } = require("../utils/sendEmail");
const Razorpay = require("razorpay");
const transporter = require("../utils/nodeMailerConfig");

paymentRouter.post("/payment/create", authUser, async (req, res) => {
  try {
    const { membershipType } = req.body;
    const { name, email } = req.user;
    const order = await instance.orders.create({
      amount: membershipAmount[membershipType] * 100,
      currency: "INR",
      receipt: `receipt#1 ${Date.now()}`,
      notes: {
        name,
        email,
        membershipType: membershipType,
      },
    });
    const payment = new Payment({
      userId: req.user._id,
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      notes: order.notes,
    });
    const savedPayment = await payment.save();

    res.json({ ...savedPayment.toJSON(), keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error("Payment creation error:", error);

    res.status(500).json({ message: error.message });
  }
});

paymentRouter.get("/premium/verify", authUser, async (req, res) => {
  try {
    const user = req.user;
    if (user.isPremium) {
      res.json({ isPremium: true, membershipType: user.membershipType });
    } else {
      res.json({ isPremium: false });
    }
  } catch (error) {
    console.error("🚨 Error:", error);
    res.status(500).json({ error: "Failed to verify premium status" });
  }
});

module.exports = paymentRouter;
