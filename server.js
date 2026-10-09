const express = require('express');
const cors = require('cors');
const path = require('path');
const Datastore = require('nedb-promises');

const app = express();
const PORT = process.env.PORT || 3000;

// Persistent Database stored to telemetry.db file
const db = Datastore.create({ filename: 'telemetry.db', autoload: true });

app.use(cors());
app.use(express.json());

// In-memory cache for fast dashboard polling
let latestTelemetry = {
  nh3: 0.0,
  ch4: 0.0,
  rssi: 0.0,
  snr: 0.0,
  timestamp: new Date().toISOString()
};

// 1. Heltec ESP32 Receiver POST endpoint (Saves to DB)
app.post('/api/telemetry', async (req, res) => {
  const { nh3, ch4, rssi, snr } = req.body;

  if (nh3 === undefined || ch4 === undefined) {
    return res.status(400).json({ error: 'Missing nh3 or ch4 payload' });
  }

  const record = {
    nh3: parseFloat(nh3),
    ch4: parseFloat(ch4),
    rssi: parseFloat(rssi) || 0.0,
    snr: parseFloat(snr) || 0.0,
    timestamp: new Date().toISOString()
  };

  latestTelemetry = record;

  try {
    // Insert into persistent database
    await db.insert(record);
    console.log('Saved to DB:', record);
    return res.status(200).json({ status: 'success', received: record });
  } catch (err) {
    console.error('Database write error:', err);
    return res.status(500).json({ error: 'Database write error' });
  }
});

// 2. Dashboard polling endpoint for live telemetry
app.get('/api/telemetry/latest', (req, res) => {
  res.json(latestTelemetry);
});

// 3. Endpoint to fetch historical data for charts
app.get('/api/telemetry/history', async (req, res) => {
  try {
    // Retrieve the latest 100 readings sorted chronologically
    const history = await db.find({}).sort({ timestamp: -1 }).limit(100);
    res.json(history.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch history' });
  }
});

// 4. CSV Export Endpoint: Generates a downloadable CSV spreadsheet
// 4. CSV Export Endpoint: Splits Date and Time into separate columns
app.get('/api/telemetry/export-csv', async (req, res) => {
  try {
    const docs = await db.find({}).sort({ timestamp: 1 });
    
    // Updated CSV header with Date and Time split
    let csv = 'Date,Time,Ammonia_NH3_ppm,Methane_CH4_ppm,LoRa_RSSI_dBm,LoRa_SNR_dB\r\n';

    docs.forEach(row => {
      const dt = new Date(row.timestamp);

      // Extract Date (YYYY-MM-DD)
      const dateStr = dt.toISOString().split('T')[0];

      // Extract Time (HH:MM:SS in 24-hr format)
      const timeStr = dt.toTimeString().split(' ')[0];

      csv += `"${dateStr}","${timeStr}",${row.nh3},${row.ch4},${row.rssi},${row.snr}\r\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment(`latrine_gas_telemetry_${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    res.status(500).send('Error generating CSV export');
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
