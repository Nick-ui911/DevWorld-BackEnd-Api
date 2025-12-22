require("dotenv").config(); // Load .env variables
const express = require("express");
const connectDB = require("./config/database");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");

const app = express();

const corsOptions = {
  origin: ["http://localhost:5173", "https://devworld.in"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};
// require("./utils/cronJob")

// Razorpay webhook (RAW body needed for webhook of razorpay)
app.use(
  "/payment/webhook",
  express.raw({ type: "application/json" }),
  require("./routes/paymentWebhook")
);

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/request");
const userRouter = require("./routes/user");
const paymentRouter = require("./routes/payment");
const initializeSocket = require("./utils/socket");
const chatRouter = require("./routes/chat");
const mailAuthRouter = require("./routes/nodeMailer");

app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);
app.use("/", paymentRouter);
app.use("/", chatRouter);
app.use("/", mailAuthRouter);
app.get("/test-cors", cors(corsOptions), (req, res) => {
  res.json({ message: "CORS is working!" });
});

const server = http.createServer(app);
initializeSocket(server);

// Connect to the database and start the server
connectDB()
  .then(() => {
    console.log("Database is connected");
    server.listen(5000, () => {
      console.log("Server is running on port 5000");
    });
  })
  .catch((err) => {
    console.error("Cannot connect to the database:", err.message);
  });
