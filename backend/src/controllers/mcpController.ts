import { Request, Response } from 'express';
import { runAgentLoop } from '../services/agentService.ts';

const runAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages must be a non-empty array' });
      return;
    }

    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user') {
      res.status(400).json({ error: 'The last message must have role "user"' });
      return;
    }

    // Pass conversation history to agent logic
    const result = await runAgentLoop(messages);

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('Error in agent controller:', error);
    res.status(500).json({
      error: 'Failed to process agent request',
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export { runAgent };