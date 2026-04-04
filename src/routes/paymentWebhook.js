const express = require("express");
const Razorpay = require("razorpay");
const Payment = require("../models/payment");
const User = require("../models/user");
const transporter = require("../utils/nodeMailerConfig");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEB_HOOK_SECRET_KEY;
    const signature = req.get("x-razorpay-signature");

    console.log("📌 Webhook Header (Signature):", signature);
    console.log("📌 Webhook Secret Available:", !!secret);
    
    if (!req.body) {
      console.error("❌ req.body is undefined");
      return res.status(400).json({ message: "Empty request body" });
    }

    let body;
    if (Buffer.isBuffer(req.body)) {
      body = req.body.toString("utf8");
    } else if (typeof req.body === "string") {
      body = req.body;
    } else {
      console.error("❌ req.body is not a Buffer or String. Type:", typeof req.body);
      body = JSON.stringify(req.body);
    }

    const isValid = Razorpay.validateWebhookSignature(
      body,
      signature,
      secret
    );

    if (!isValid) {
      console.error("❌ Invalid webhook signature. Secret:", secret, "Signature:", signature);
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    // Extract payment data
    const payload = JSON.parse(body);
    const paymentData = payload.payload.payment.entity;
    const event = payload.event;

    console.log("📌 Webhook event:", event);
    console.log("📌 Order ID:", paymentData.order_id);

    // Find and update payment in DB
    const payment = await Payment.findOne({ orderId: paymentData.order_id });

    if (!payment) {
      console.error("❌ Payment not found for orderId:", paymentData.order_id);
      return res.status(404).json({ message: "Payment not found" });
    }

    payment.status = paymentData.status;
    await payment.save();
    console.log("📌 Payment status updated to:", payment.status);

    // Find and update user based on payment
    const user = await User.findOne({ _id: payment.userId });

    if (!user) {
      console.error("❌ User not found for userId:", payment.userId);
      return res.status(404).json({ message: "User not found" });
    }

    const mailOptions = {
      from: process.env.EMAIL_ADMIN,
      to: user.email,
      subject: "Payment Confirmation - Thank You for Your Purchase!",
      text: `Dear ${user.name},\n\nWe are pleased to inform you that we have successfully received your payment for the ${payment.notes.membershipType} membership.\n\nThank you for choosing our service! Your premium benefits are now active. If you have any questions, feel free to reach out to our support team.\n\nBest regards,\nDevWorld Team`,
    };
    const mailOptions2 = {
      from: process.env.EMAIL_ADMIN,
      to: user.email,
      subject: "Payment Failed - Action Required",
      text: `Dear ${user.name},\n\nUnfortunately, your payment for the ${payment.notes.membershipType} membership could not be processed.\n\nPlease try again or contact our support team if you continue to experience issues. We're here to help!\n\nBest regards,\nDevWorld Team`,
    };

    if (event === "payment.captured") {
      user.isPremium = true;
      user.membershipType = payment.notes.membershipType;
      await user.save();
      console.log("📌 User upgraded to premium:", user.email);
      try {
        await transporter.sendMail(mailOptions);
        console.log("📧 Payment success email sent to:", user.email);
      } catch (emailErr) {
        console.error("⚠️ Failed to send success email:", emailErr.message);
        // Don't fail the webhook just because email failed
      }
    } else if (event === "payment.failed") {
      try {
        await transporter.sendMail(mailOptions2);
        console.log("📧 Payment failure email sent to:", user.email);
      } catch (emailErr) {
        console.error("⚠️ Failed to send failure email:", emailErr.message);
      }
    }

    // ✅ Always respond 200 to Razorpay so it doesn't retry
    res.status(200).json({ status: "Webhook received" });
  } catch (error) {
    console.error("🚨 Webhook error:", error.message || error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

module.exports = router;

