// src/routes/routes.js
import express from 'express';
import { getWalletStatus } from '../controllers/walletController.ts';
import { searchFlightsHandler } from '../controllers/searchFlightController.ts';
import { runAgentHandler} from '../controllers/flightAgentController.ts';
import { getMonitorTasks } from '../controllers/getMonitorController.ts';
import { authController } from '../controllers/authController.ts';
const router = express.Router();

router.get('/wallet/status', getWalletStatus);

router.get('/flights/search', searchFlightsHandler);
router.get('/monitor/tasks', getMonitorTasks);
router.post('/agent/run', runAgentHandler);

router.post('/signup', upload.single('passportPhoto'), authController.signUp);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
export default router;