// src/controllers/flightAgentController.ts
import type { Request, Response } from 'express';
import { MonitorTaskModel } from '../models/monitorTask.ts';

const getMonitorTasks = async (req: Request, res: Response): Promise<Response> => {
  try {
    const tasks = await MonitorTaskModel.findAll();
    return res.json({ 
      success: true, 
      count: tasks.length,
      tasks 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch monitoring tasks';
    return res.status(500).json({ success: false, error: message });
  }
};

export { getMonitorTasks };