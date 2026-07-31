// src/controllers/walletController.js
import { fetchAgentWallet } from '../services/getWallet.js';
import type { Request, Response } from 'express';

export const getWalletStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const wallet = await fetchAgentWallet();
    return res.json({ success: true, wallet });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(500).json({ success: false, error: message });
  }
};