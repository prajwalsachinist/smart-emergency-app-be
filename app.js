const express = require("express");
const cors = require("cors");

const incidentsRoutes = require("./routes/incidents");
const unitsRoutes = require("./routes/units");
const simulateRoutes = require("./routes/simulate");
const notificationsRoutes = require("./routes/notifications");

const app = express();

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "smart-emergency-app-be",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/incidents", incidentsRoutes);
app.use("/api/units", unitsRoutes);
app.use("/api/simulate", simulateRoutes);
app.use("/api/notifications", notificationsRoutes);

module.exports = app;
