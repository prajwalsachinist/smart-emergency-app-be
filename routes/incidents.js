const express = require("express");
const {
  getIncidents,
  getIncidentById,
  createIncident,
  updateIncidentStatus,
  escalateIncident,
} = require("../controllers/incidentController");

const router = express.Router();

router.get("/", getIncidents);
router.get("/:id", getIncidentById);
router.post("/", createIncident);
router.patch("/:id/status", updateIncidentStatus);
router.post("/:id/status", updateIncidentStatus);
router.patch("/:id/escalate", escalateIncident);
router.post("/:id/escalate", escalateIncident);

module.exports = router;
