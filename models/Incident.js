const mongoose = require("mongoose");

const timelineItemSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    incidentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "open",
        "assigned",
        "acknowledged",
        "en_route",
        "on_site",
        "resolved",
        "cancelled",
      ],
      default: "open",
      required: true,
    },
    locationName: {
      type: String,
      required: true,
      trim: true,
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
    assignedUnit: {
      type: String,
      default: null,
      trim: true,
    },
    eta: {
      type: String,
      default: null,
      trim: true,
    },
    escalationLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },
    timeline: {
      type: [timelineItemSchema],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

incidentSchema.index({ createdAt: -1 });
incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ assignedUnit: 1, createdAt: -1 });
incidentSchema.index({ incidentId: 1 });

module.exports = mongoose.model("Incident", incidentSchema);
