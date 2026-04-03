const express = require("express");
const Razorpay = require("razorpay");
const Payment = require("../models/payment");
const User = require("../models/user");
const transporter = require("../utils/nodeMailerConfig");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    // console.log("📌 Webhook received at:", new Date().toISOString());

    const secret = process.env.RAZORPAY_WEB_HOOK_SECRET_KEY;
    const signature = req.get("x-razorpay-signature");
const rawBody = req.body; // buffer
const body = rawBody.toString(); // string for parsing

const isValid = Razorpay.validateWebhookSignature(
  rawBody, // ✅ MUST be buffer
  signature,
  secret
);

    if (!isValid) {
      // console.error("❌ Invalid webhook signature");
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    // Extract payment data
    const payload = JSON.parse(body);
    const paymentData = payload.payload.payment.entity;
    const event = payload.event;

    // console.log("📌 Payment Data:", paymentData);
    // console.log("📌 Event:", event);

    // Find and update payment in DB
    const payment = await Payment.findOne({ orderId: paymentData.order_id });

    if (!payment) {
      console.error("❌ Payment not found for orderId:", paymentData.order_id);
      return res.status(404).json({ message: "Payment not found" });
    }

    // console.log("📌 Payment Found:", payment);

    payment.status = paymentData.status;
    await payment.save();
    // console.log("📌 Payment Status Updated:", payment.status);

    // Find and update user based on payment
    const user = await User.findOne({ _id: payment.userId });

    if (!user) {
      console.error("❌ User not found for userId:", payment.userId);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("📌 User Found:", user);

    const mailOptions = {
      from: process.env.EMAIL_ADMIN, // Always send from your own email
      to: user.email, // User's email
      subject: "Payment Confirmation - Thank You for Your Purchase!",
      text: `Dear ${user.name},
    
    We are pleased to inform you that we have successfully received your payment for the **${payment.notes.membershipType}** membership.
    
    Thank you for choosing our service! Your premium benefits are now active. If you have any questions, feel free to reach out to our support team.
    
    Best regards,  
    DevTinder Team`,
    };
    const mailOptions2 = {
      from: process.env.EMAIL_ADMIN, // Always send from your own email
      to: user.email, // User's email
      subject: "Payment Failed - Action Required",
      text: `Dear ${user.name},
    
    Unfortunately, your payment for the **${payment.notes.membershipType}** membership could not be processed.
    
    Please try again or contact our support team if you continue to experience issues. We're here to help!
    
    Best regards,  
    DevTinder Team`,
    };

    if (event === "payment.captured") {
      user.isPremium = true;
      user.membershipType = payment.notes.membershipType;
      await user.save();
      await transporter.sendMail(mailOptions);
    } else if (event === "payment.failed") {
      await transporter.sendMail(mailOptions2);
    }

    res.status(200).json({ status: "Webhook received" });
  } catch (error) {
    console.error("🚨 Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});
module.exports = router;
