const Incident = require("../models/Incident");
const Notification = require("../models/Notification");

const ESCALATABLE_STATUSES = ["open", "assigned"];

function severityThresholdSeconds(severity) {
  const key = String(severity || "").toLowerCase();
  if (key === "critical") return 30;
  if (key === "high") return 60;
  if (key === "medium") return 180;
  return 240;
}

function buildEscalationLabel(level) {
  return `Auto-escalated to level ${level}`;
}

async function runEscalationCycle(io) {
  const candidates = await Incident.find({
    status: { $in: ESCALATABLE_STATUSES },
  });

  for (const incident of candidates) {
    const threshold = severityThresholdSeconds(incident.severity);
    const createdAt = new Date(incident.createdAt).getTime();
    if (Number.isNaN(createdAt)) continue;

    const elapsedSeconds = Math.floor((Date.now() - createdAt) / 1000);
    const desiredLevel = Math.min(3, Math.floor(elapsedSeconds / threshold));

    if (desiredLevel <= Number(incident.escalationLevel || 0)) {
      continue;
    }

    incident.escalationLevel = desiredLevel;
    incident.timeline.unshift({
      label: buildEscalationLabel(desiredLevel),
      timestamp: new Date(),
    });

    // On escalation level > 1, check if current assignment is still optimal and reassign if needed
    if (incident.assignedUnit && desiredLevel > 1) {
      const { assignBestUnitToIncident } = require("./dispatchService");

      try {
        // Get current unit and release it
        const currentUnit = await Incident.collection.db
          .collection("units")
          .findOne({ unitId: incident.assignedUnit });

        if (currentUnit) {
          // Release current unit
          await Incident.collection.db.collection("units").updateOne(
            { unitId: incident.assignedUnit },
            { $set: { status: "available" } }
          );

          // Reset assignment so reassignment can happen
          incident.assignedUnit = null;

          // Reassign to optimal unit (distance-based with high priority)
          const { unit: newUnit } = await assignBestUnitToIncident(incident);

          if (newUnit && newUnit.unitId !== currentUnit.unitId) {
            incident.timeline.unshift({
              label: `Reassigned from ${currentUnit.unitId} to ${newUnit.unitId} (escalation L${desiredLevel})`,
              timestamp: new Date(),
            });
          }
        }
      } catch (reassignmentError) {
        console.error("Escalation reassignment error:", reassignmentError.message);
      }
    }

    await incident.save();

    const notification = await Notification.create({
      title: "Incident escalated",
      message: `${incident.incidentId} escalated to level ${desiredLevel}`,
      role: "operator",
      incidentId: incident.incidentId,
      createdAt: new Date(),
    });

    if (io) {
      io.emit("incidentUpdated", incident);
      io.emit("incidentEscalated", incident);
      io.emit("notificationCreated", notification);
    }
  }
}

function startEscalationMonitor({ io, intervalMs } = {}) {
  const enabled = String(process.env.ENABLE_AUTO_ESCALATION || "false").toLowerCase() === "true";
  if (!enabled) {
    console.log("Auto-escalation disabled (set ENABLE_AUTO_ESCALATION=true to enable).");
    return null;
  }

  const tickMs = Number(intervalMs || process.env.ESCALATION_INTERVAL_MS || 15000);
  let inProgress = false;

  const run = async () => {
    if (inProgress) return;
    inProgress = true;
    try {
      await runEscalationCycle(io);
    } catch (error) {
      console.error("Escalation monitor error:", error.message);
    } finally {
      inProgress = false;
    }
  };

  const timer = setInterval(run, tickMs);
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  run();

  return timer;
}

module.exports = {
  startEscalationMonitor,
  runEscalationCycle,
};
