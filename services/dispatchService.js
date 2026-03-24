const Incident = require("../models/Incident");
const Unit = require("../models/Unit");

// Calculate haversine distance between two coordinates (in kilometers)
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in km
}

function mapIncidentTypeToUnitType(type = "") {
  const key = String(type).toLowerCase();

  if (key.includes("medical")) return "ambulance";
  if (key.includes("fire")) return "fire";
  if (key.includes("security")) return "security";
  if (key.includes("water") || key.includes("power")) return "maintenance";

  return null;
}

function randomEta() {
  const minutes = Math.floor(Math.random() * 8) + 3;
  return `${minutes} min`;
}

function buildAutoUnitId(type, count) {
  const prefixMap = {
    ambulance: "AMB",
    fire: "FIRE",
    security: "SEC",
    maintenance: "MNT",
  };
  const prefix = prefixMap[type] || "UNIT";
  const number = String(count + 1).padStart(2, "0");
  return `${prefix}-${number}`;
}

function defaultCapacity(type) {
  if (type === "ambulance") return 2;
  if (type === "fire") return 5;
  if (type === "security") return 4;
  return 3;
}

async function assignBestUnitToIncident(incidentInput) {
  const incident =
    incidentInput instanceof Incident ? incidentInput : await Incident.findById(incidentInput);

  if (!incident) {
    return { incident: null, unit: null };
  }

  const unitType = mapIncidentTypeToUnitType(incident.type);
  if (!unitType) {
    return { incident, unit: null };
  }

  // Find all available units of the required type
  const availableUnits = await Unit.find({ type: unitType, status: "available" });

  // Score each unit: prefer closer + higher capacity
  let unit = null;
  let bestScore = Infinity;

  for (const u of availableUnits) {
    const distance = haversineDistance(
      incident.location.lat,
      incident.location.lng,
      u.location.lat,
      u.location.lng
    );

    // Score: distance (lower is better) - 0.1 * capacity (higher capacity reduces score)
    const score = distance - u.capacity * 0.1;

    if (score < bestScore) {
      bestScore = score;
      unit = u;
    }
  }

  // If no available unit, create new one
  if (!unit) {
    const existingCount = await Unit.countDocuments({ type: unitType });
    unit = await Unit.create({
      unitId: buildAutoUnitId(unitType, existingCount),
      type: unitType,
      status: "busy",
      location: {
        lat: incident.location?.lat || 12.9716,
        lng: incident.location?.lng || 77.5946,
      },
      capacity: defaultCapacity(unitType),
    });
  } else {
    unit.status = "busy";
    await unit.save();
  }

  incident.assignedUnit = unit.unitId;
  incident.status = "assigned";
  incident.eta = incident.eta || randomEta();
  incident.timeline.unshift({
    label: `Unit ${unit.unitId} assigned`,
    timestamp: new Date(),
  });
  await incident.save();

  return { incident, unit };
}

async function releaseAssignedUnit(incidentInput) {
  const incident =
    incidentInput instanceof Incident ? incidentInput : await Incident.findById(incidentInput);

  if (!incident || !incident.assignedUnit) {
    return null;
  }

  const unit = await Unit.findOne({ unitId: incident.assignedUnit });
  if (!unit) {
    return null;
  }

  unit.status = "available";
  if (incident.location?.lat && incident.location?.lng) {
    unit.location = {
      lat: incident.location.lat,
      lng: incident.location.lng,
    };
  }
  await unit.save();

  return unit;
}

module.exports = {
  mapIncidentTypeToUnitType,
  assignBestUnitToIncident,
  releaseAssignedUnit,
};
