import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Flight Agent Backend API is active!',
    endpoints: [
      '/api/wallet/status',
      '/api/flights/search'
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✈️ Server running on http://localhost:${PORT}`);
});