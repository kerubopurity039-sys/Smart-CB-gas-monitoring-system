const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve the frontend static files (including index.html)
app.use(express.static(path.join(__dirname, '.')));

// In-memory store for the latest telemetry reading
let latestTelemetry = {
  nh3: 0.0,
  ch4: 0.0,
  rssi: 0.0,
  snr: 0.0,
  timestamp: new Date().toISOString()
};

// 1. Endpoint for Heltec LoRa Receiver to POST incoming sensor packets
app.post('/api/telemetry', (req, res) => {
  const { nh3, ch4, rssi, snr } = req.body;

  if (nh3 === undefined || ch4 === undefined) {
    return res.status(400).json({ error: 'Missing nh3 or ch4 payload' });
  }

  latestTelemetry = {
    nh3: parseFloat(nh3),
    ch4: parseFloat(ch4),
    rssi: parseFloat(rssi) || 0.0,
    snr: parseFloat(snr) || 0.0,
    timestamp: new Date().toISOString()
  };

  console.log('Incoming Telemetry:', latestTelemetry);
  return res.status(200).json({ status: 'success', received: latestTelemetry });
});

// 2. Endpoint for your Web Dashboard to GET the newest reading
app.get('/api/telemetry/latest', (req, res) => {
  res.json(latestTelemetry);
});

// 3. Fallback route to serve the dashboard on the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
