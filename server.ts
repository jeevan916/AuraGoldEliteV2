
import express from 'express';
import cors from 'cors';

const app = express();
// Fix: Using 'as any' to resolve type mismatch in app.use for middleware caused by conflicting @types versions
app.use(cors() as any);
app.use(express.json({ limit: '50mb' }) as any);

// Memory storage (In production, replace with MySQL as requested via Hostinger)
let appState: any = null;

// Fix: Use 'any' for Request and Response parameters to resolve missing property errors (json, status, body)
// caused by environmental type definition conflicts where Express extensions are not being picked up correctly.
app.get('/api/state', (req: any, res: any) => {
  if (appState) {
    res.json(appState);
  } else {
    res.status(404).json({ error: "No state found" });
  }
});

app.post('/api/state', (req: any, res: any) => {
  appState = {
    ...req.body,
    lastUpdated: Date.now()
  };
  res.json({ success: true, timestamp: appState.lastUpdated });
});

app.get('/api/gold-rate', (req: any, res: any) => {
  res.json({
    k24: 7850,
    k22: 7180,
    k18: 5880,
    timestamp: Date.now()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AuraGold Backend operational on port ${PORT}`);
});
