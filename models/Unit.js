const mongoose = require("mongoose");

const unitSchema = new mongoose.Schema(
  {
    unitId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["ambulance", "fire", "security", "maintenance"],
      required: true,
    },
    status: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "available",
      required: true,
    },
    location: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
    },
    capacity: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true, versionKey: false }
);

unitSchema.index({ unitId: 1 });
unitSchema.index({ type: 1, status: 1, createdAt: 1 });
unitSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Unit", unitSchema);
