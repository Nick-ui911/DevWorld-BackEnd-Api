require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const Payment = require("../models/payment");
const User = require("../models/user");
const transporter = require("../utils/nodeMailerConfig");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEB_HOOK_SECRET_KEY;
    const signature = req.headers["x-razorpay-signature"];

    console.log("📌 Signature:", signature);
    console.log("📌 Secret exists:", !!secret);
    console.log("📌 Is Buffer:", Buffer.isBuffer(req.body));

    // ✅ RAW BODY (VERY IMPORTANT)
    const rawBody = req.body; // buffer
    const body = rawBody.toString(); // string for JSON.parse

    // ✅ Validate signature (MUST use buffer)
    const isValid = Razorpay.validateWebhookSignature(
      rawBody,
      signature,
      secret
    );

    console.log("✅ Signature valid:", isValid);

    if (!isValid) {
      console.error("❌ Invalid webhook signature");
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    // ✅ Parse payload AFTER validation
    const payload = JSON.parse(body);
    const paymentData = payload.payload.payment.entity;
    const event = payload.event;

    console.log("📌 Event:", event);
    console.log("📌 Order ID:", paymentData.order_id);

    // ✅ Find payment
    const payment = await Payment.findOne({
      orderId: paymentData.order_id,
    });

    if (!payment) {
      console.error("❌ Payment not found:", paymentData.order_id);
      return res.status(404).json({ message: "Payment not found" });
    }

    // ✅ Prevent duplicate webhook execution
    if (payment.status === paymentData.status) {
      console.log("⚠️ Duplicate webhook ignored");
      return res.status(200).send("Already processed");
    }

    // ✅ Update payment
    payment.status = paymentData.status;
    await payment.save();

    console.log("📌 Payment updated:", payment.status);

    // ✅ Find user
    const user = await User.findById(payment.userId);

    if (!user) {
      console.error("❌ User not found:", payment.userId);
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Email templates
    const successMail = {
      from: process.env.EMAIL_ADMIN,
      to: user.email,
      subject: "Payment Successful 🎉",
      text: `Hi ${user.name},

Your payment for ${payment.notes.membershipType} is successful.

Enjoy premium features 🚀

- DevWorld Team`,
    };

    const failedMail = {
      from: process.env.EMAIL_ADMIN,
      to: user.email,
      subject: "Payment Failed ❌",
      text: `Hi ${user.name},

Your payment failed. Please try again.

- DevWorld Team`,
    };

    // ✅ Handle events
    if (event === "payment.captured") {
      user.isPremium = true;
      user.membershipType = payment.notes.membershipType;
      await user.save();

      try {
        await transporter.sendMail(successMail);
        console.log("📧 Success email sent");
      } catch (err) {
        console.error("⚠️ Email failed:", err.message);
      }
    }

    if (event === "payment.failed") {
      try {
        await transporter.sendMail(failedMail);
        console.log("📧 Failure email sent");
      } catch (err) {
        console.error("⚠️ Email failed:", err.message);
      }
    }

    // ✅ Always return 200 (VERY IMPORTANT)
    res.status(200).json({ status: "Webhook received" });

  } catch (error) {
    console.error("🚨 Webhook error:", error.message);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

module.exports = router;