import express from 'express';
import cors from 'cors';

const app = express();
const port = 3003;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Simple Route Planner API is running', version: '1.0.0' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Simple server running on port ${port}`);
});