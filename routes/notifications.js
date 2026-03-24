const express = require("express");

const Incident = require("../models/Incident");
const Notification = require("../models/Notification");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const role = String(req.query.role || "all").toLowerCase();
    const unitId = String(req.query.unitId || "").trim();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

    const roleFilter =
      role === "operator" || role === "responder"
        ? { role: { $in: [role, "all"] } }
        : {};

    const query = { ...roleFilter };

    if (role === "responder") {
      if (!unitId) {
        return res.status(200).json([]);
      }

      const assignedIncidentIds = await Incident.find({ assignedUnit: unitId }).distinct("incidentId");
      if (!assignedIncidentIds.length) {
        return res.status(200).json([]);
      }

      query.incidentId = { $in: assignedIncidentIds };
    }

    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    return res.status(200).json(notifications);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
  }
});

module.exports = router;
