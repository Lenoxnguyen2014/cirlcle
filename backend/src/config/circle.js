import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
// Initialize Circle Client (Agent Wallet)
const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY || '',
  entitySecret: process.env.CIRCLE_ENTITY_SECRET || '',
  accountType: 'SCA'
});

export { circleClient };