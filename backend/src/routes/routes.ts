// src/routes/routes.js
import express from 'express';
import { getWalletStatus } from '../controllers/walletController.ts';
import { searchFlightsHandler } from '../controllers/searchFlightController.ts';
import { runAgentHandler} from '../controllers/flightAgentController.ts';
import { getMonitorTasks } from '../controllers/getMonitorController.ts';

const router = express.Router();

router.get('/api/wallet/status', getWalletStatus);

router.get('api/flights/search', searchFlightsHandler);
router.get('/api/monitor/tasks', getMonitorTasks);
router.post('/api/agent/run', runAgentHandler);

export default router;