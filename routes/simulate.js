const express = require("express");

const Incident = require("../models/Incident");
const Notification = require("../models/Notification");
const { assignBestUnitToIncident } = require("../services/dispatchService");

const router = express.Router();

const INCIDENT_TEMPLATES = {
  medical: {
    type: "medical",
    severity: "high",
    locationName: "Block A - Lobby",
  },
  fire: {
    type: "fire",
    severity: "critical",
    locationName: "Block C - Electrical Room",
  },
  security: {
    type: "security breach",
    severity: "medium",
    locationName: "Gate 2 - Parking Entry",
  },
};

function randomCoordinate(base, spread = 0.015) {
  return Number((base + (Math.random() * spread - spread / 2)).toFixed(6));
}

function generateIncidentId() {
  const stamp = Date.now().toString().slice(-7);
  const suffix = Math.floor(Math.random() * 90 + 10);
  return `INC${stamp}${suffix}`;
}

function resolveTemplate(type) {
  const key = String(type || "").toLowerCase();
  if (key.includes("fire")) return INCIDENT_TEMPLATES.fire;
  if (key.includes("security")) return INCIDENT_TEMPLATES.security;
  return INCIDENT_TEMPLATES.medical;
}

router.post("/incident", async (req, res) => {
  try {
    const payload = req.body || {};
    const template = resolveTemplate(payload.type);
    const incident = await Incident.create({
      incidentId: generateIncidentId(),
      type: template.type,
      severity: template.severity,
      status: "open",
      locationName: template.locationName,
      location: {
        lat: randomCoordinate(12.9716),
        lng: randomCoordinate(77.5946),
      },
      escalationLevel: 0,
      timeline: [
        {
          label: "Incident created via simulation",
          timestamp: new Date(),
        },
      ],
    });

    const { incident: assignedIncident, unit } = await assignBestUnitToIncident(incident);
    const outputIncident = assignedIncident || incident;

    const notification = await Notification.create({
      title: "Simulated incident created",
      message: `${outputIncident.incidentId} (${outputIncident.type}) created`,
      role: "all",
      incidentId: outputIncident.incidentId,
      createdAt: new Date(),
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("incidentCreated", outputIncident);
      io.emit("incidentUpdated", outputIncident);
      if (unit) {
        io.emit("unitUpdated", unit);
      }
      io.emit("notificationCreated", notification);
    }

    return res.status(201).json(outputIncident);
  } catch (error) {
    return res.status(400).json({ message: "Failed to simulate incident", error: error.message });
  }
});

module.exports = router;
