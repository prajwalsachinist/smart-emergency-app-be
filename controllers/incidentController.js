const mongoose = require("mongoose");

const Incident = require("../models/Incident");
const Notification = require("../models/Notification");
const { assignBestUnitToIncident, releaseAssignedUnit } = require("../services/dispatchService");

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function buildStatusLabel(status) {
  if (!status) return "Incident created";
  return `Status changed to ${String(status).replaceAll("_", " ")}`;
}

function isClosedStatus(status) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "resolved" || normalized === "cancelled";
}

function generateIncidentId() {
  const stamp = Date.now().toString().slice(-7);
  const suffix = Math.floor(Math.random() * 90 + 10);
  return `INC${stamp}${suffix}`;
}

function notificationRoleFromStatus(status) {
  const key = String(status || "").toLowerCase();
  if (key === "assigned" || key === "open") return "responder";
  return "all";
}

function escalateSeverity(currentSeverity) {
  const order = ["low", "medium", "high", "critical"];
  const normalized = String(currentSeverity || "").toLowerCase();
  const currentIndex = order.indexOf(normalized);
  if (currentIndex < 0) return "medium";
  return order[Math.min(order.length - 1, currentIndex + 1)];
}

async function getIncidents(req, res) {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json(incidents);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch incidents", error: error.message });
  }
}

async function getIncidentById(req, res) {
  try {
    const { id } = req.params;
    const query = isObjectId(id) ? { _id: id } : { incidentId: id };
    const incident = await Incident.findOne(query).lean();

    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    return res.status(200).json(incident);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch incident", error: error.message });
  }
}

async function createIncident(req, res) {
  try {
    const payload = req.body || {};
    const status = payload.status || "open";
    const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];

    if (timeline.length === 0) {
      timeline.unshift({
        label: payload.timelineLabel || "Incident created",
        timestamp: new Date(),
      });
    }

    const incident = await Incident.create({
      ...payload,
      incidentId: payload.incidentId || generateIncidentId(),
      status,
      escalationLevel: typeof payload.escalationLevel === "number" ? payload.escalationLevel : 0,
      timeline,
    });

    const { incident: dispatchedIncident, unit } = await assignBestUnitToIncident(incident);
    const outputIncident = dispatchedIncident || incident;
    const notification = await Notification.create({
      title: "Incident created",
      message: `${outputIncident.incidentId} (${outputIncident.type}) created`,
      role: "all",
      incidentId: outputIncident.incidentId,
      createdAt: new Date(),
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("incidentCreated", outputIncident);
      if (unit) {
        io.emit("incidentUpdated", outputIncident);
      }
      io.emit("notificationCreated", notification);
    }

    return res.status(201).json(outputIncident);
  } catch (error) {
    return res.status(400).json({ message: "Failed to create incident", error: error.message });
  }
}

async function updateIncidentStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, timelineLabel } = req.body || {};

    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    const query = isObjectId(id) ? { _id: id } : { incidentId: id };
    const incident = await Incident.findOne(query);

    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    incident.status = status;
    incident.timeline.unshift({
      label: timelineLabel || buildStatusLabel(status),
      timestamp: new Date(),
    });

    const closed = isClosedStatus(status);
    if (closed) {
      incident.eta = null;
    }

    await incident.save();

    if (closed) {
      await releaseAssignedUnit(incident);
    }

    const notification = await Notification.create({
      title: "Incident status updated",
      message: `${incident.incidentId} is now ${String(status).replaceAll("_", " ")}`,
      role: notificationRoleFromStatus(status),
      incidentId: incident.incidentId,
      createdAt: new Date(),
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("incidentUpdated", incident);
      if (closed) {
        io.emit("incidentResolved", incident);
      }
      io.emit("notificationCreated", notification);
    }

    return res.status(200).json(incident);
  } catch (error) {
    return res.status(400).json({ message: "Failed to update incident status", error: error.message });
  }
}

async function escalateIncident(req, res) {
  try {
    const { id } = req.params;
    const { timelineLabel, increaseSeverity = false } = req.body || {};

    const query = isObjectId(id) ? { _id: id } : { incidentId: id };
    const incident = await Incident.findOne(query);

    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    if (isClosedStatus(incident.status)) {
      return res.status(400).json({ message: "Closed incident cannot be escalated" });
    }

    incident.escalationLevel = Math.min(3, Number(incident.escalationLevel || 0) + 1);
    if (increaseSeverity) {
      incident.severity = escalateSeverity(incident.severity);
    }
    incident.timeline.unshift({
      label: timelineLabel || `Escalated to level ${incident.escalationLevel}`,
      timestamp: new Date(),
    });
    await incident.save();

    const escalationNotification = await Notification.create({
      title: "Incident escalated",
      message: increaseSeverity
        ? `${incident.incidentId} escalated to level ${incident.escalationLevel} (${incident.severity})`
        : `${incident.incidentId} escalated to level ${incident.escalationLevel}`,
      role: "all",
      incidentId: incident.incidentId,
      createdAt: new Date(),
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("incidentUpdated", incident);
      io.emit("incidentEscalated", incident);
      io.emit("notificationCreated", escalationNotification);
    }

    return res.status(200).json(incident);
  } catch (error) {
    return res.status(400).json({ message: "Failed to escalate incident", error: error.message });
  }
}

module.exports = {
  getIncidents,
  getIncidentById,
  createIncident,
  updateIncidentStatus,
  escalateIncident,
};
