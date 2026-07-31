// src/routes/routes.js
import express from 'express';
import { getWalletStatus } from '../controllers/walletController.ts';
import { searchFlightsHandler } from '../controllers/searchFlightController.ts';
import { runAgentHandler} from '../controllers/flightAgentController.ts';
import { getMonitorTasks } from '../controllers/getMonitorController.ts';

const router = express.Router();

router.get('/wallet/status', getWalletStatus);

router.get('/flights/search', searchFlightsHandler);
router.get('/monitor/tasks', getMonitorTasks);
router.post('/agent/run', runAgentHandler);

export default router;