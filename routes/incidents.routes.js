const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "Incidents route ready",
    data: [],
  });
});

module.exports = router;
