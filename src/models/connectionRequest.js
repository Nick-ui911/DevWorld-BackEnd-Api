const mongoose = require("mongoose");

const connectionRequestSchema = new mongoose.Schema(
    {
        fromUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref:"User",
            required: true,
        },
        toUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref:"User",
            required: true,
        },
        status: {
            type: String,
            required: true,
            enum: {
                values: ["rejected", "accepted", "ignored", "interested"],
                message: `{VALUE} is an incorrect status type`,
            },
        },
    },
    { timestamps: true }
);


connectionRequestSchema.index({fromUserId: 1,toUserId: 1});
// Pre-save hook to prevent self-connection
connectionRequestSchema.pre("save", function (next) {
    const connectionRequest = this;

    if (connectionRequest.fromUserId.equals(connectionRequest.toUserId)) {
        return next(new Error("You can't send a connection request to yourself"));
    }

    next();
});
// Create a Mongoose model named "ConnectionRequest" based on connectionRequestSchema.
// This model represents the "connectionrequests"(because this converted in plural by mongoose "ConnectionRequest") collection in MongoDB 
// and is used to perform CRUD operations on it.

const ConnectionRequest = mongoose.model(
    "ConnectionRequest",
    connectionRequestSchema
);

module.exports = ConnectionRequest;
