const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["operator", "responder", "all"],
      default: "all",
      required: true,
    },
    incidentId: {
      type: String,
      default: null,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

notificationSchema.index({ role: 1, createdAt: -1 });
notificationSchema.index({ incidentId: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
