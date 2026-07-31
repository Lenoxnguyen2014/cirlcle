import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { duffel } from '../config/duffel.js';
import { circleClient } from '../config/circle';



const executeCircleBooking = async (flightId: string, priceUsdc: string, recipientAddress?: string) => {
  console.log(`Executing Circle USDC Payment: $${priceUsdc} for Flight ${flightId}...`);

  if (process.env.CIRCLE_API_KEY && process.env.CIRCLE_AGENT_WALLET_ID && process.env.CIRCLE_USDC_TOKEN_ID) {
    //mock transaction for testing
    const response = await circleClient.createTransaction({
      idempotencyKey: crypto.randomUUID(),
      walletId: process.env.CIRCLE_AGENT_WALLET_ID,
      tokenId: process.env.CIRCLE_USDC_TOKEN_ID,
      destinationAddress: recipientAddress || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      amount: [priceUsdc.toString()],
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    });

    return {
      success: true,
      transactionId: response.data?.id,
      txHash: response.data?.txHash || 'Pending',
      blockExplorerUrl: `https://sepolia.basescan.org/tx/${response.data?.txHash || ''}`,
    };
  }

}

export { executeCircleBooking };