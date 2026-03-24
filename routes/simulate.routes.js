const express = require("express");

const router = express.Router();

router.post("/", (req, res) => {
  const io = req.app.get("io");
  const payload = req.body || {};

  if (io) {
    io.emit("simulation:triggered", payload);
  }

  res.status(200).json({
    message: "Simulation triggered",
    payload,
  });
});

module.exports = router;
