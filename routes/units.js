const express = require("express");
const {
  getUnits,
  createUnit,
  updateUnitStatus,
} = require("../controllers/unitController");

const router = express.Router();

router.get("/", getUnits);
router.post("/", createUnit);
router.patch("/:id/status", updateUnitStatus);

module.exports = router;
