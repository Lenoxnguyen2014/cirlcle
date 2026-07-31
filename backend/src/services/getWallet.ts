// src/services/getWallet.js
import { circleClient } from '../config/circle.js';

const fetchAgentWallet = async () => {
  if (process.env.CIRCLE_API_KEY) {
    const response = await circleClient.getWallet({
      id: process.env.CIRCLE_AGENT_WALLET_ID,
    });
    return response.data?.wallet;
  }
  return null;
};

export { fetchAgentWallet };