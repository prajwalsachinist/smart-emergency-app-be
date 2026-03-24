const mongoose = require("mongoose");

const Unit = require("../models/Unit");

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function getUnits(req, res) {
  try {
    const units = await Unit.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json(units);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch units", error: error.message });
  }
}

async function createUnit(req, res) {
  try {
    const unit = await Unit.create(req.body);
    return res.status(201).json(unit);
  } catch (error) {
    return res.status(400).json({ message: "Failed to create unit", error: error.message });
  }
}

async function updateUnitStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    const query = isObjectId(id) ? { _id: id } : { unitId: id };
    const unit = await Unit.findOne(query);

    if (!unit) {
      return res.status(404).json({ message: "Unit not found" });
    }

    unit.status = status;
    await unit.save();

    return res.status(200).json(unit);
  } catch (error) {
    return res.status(400).json({ message: "Failed to update unit status", error: error.message });
  }
}

module.exports = {
  getUnits,
  createUnit,
  updateUnitStatus,
};
