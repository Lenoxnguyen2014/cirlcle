import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { appendFileSync } from "node:fs";
import "dotenv/config";

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

if (!apiKey || !entitySecret) {
  console.error("CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be in your .env file!");
  process.exit(1);
}

const client = initiateDeveloperControlledWalletsClient({
  apiKey,
  entitySecret,
});

async function setupWallet() {
  console.log("🚀 Creating Wallet Set and Agent Wallet on Base Sepolia...");

  // 1. Create Wallet Set
  const walletSetRes = await client.createWalletSet({
    name: "Flight Agent Wallet Set",
  });
  const walletSetId = walletSetRes.data?.walletSet?.id;

  if (!walletSetId) {
    throw new Error("Failed to create Wallet Set");
  }

  // 2. Create Agent Wallet on Base Sepolia
  const walletRes = await client.createWallets({
    blockchains: ["BASE-SEPOLIA"],
    count: 1,
    walletSetId,
  });

  const wallet = walletRes.data?.wallets?.[0];
  if (!wallet) {
    throw new Error("Failed to create Wallet");
  }

  // 3. Fetch Token Balances for the Wallet to grab the USDC Token ID
  let usdcTokenId = "";

  try {
    const balancesRes = await client.getWalletTokenBalance({
      id: wallet.id,
    });
    
    // Find USDC in the token balances
    const usdcBalance = balancesRes.data?.tokenBalances?.find(
      (b) => b.token?.symbol === "USDC"
    );
    
    usdcTokenId = usdcBalance?.token?.id || "";
  } catch (err) {
    console.log("Balance lookup pending wallet deployment.");
  }

  // Fallback to Base Sepolia USDC standard ID if balance array is initializing
  if (!usdcTokenId) {
    // Standard Base Sepolia USDC Token ID on Circle Sandbox
    usdcTokenId = "579102c1-3d71-4122-a818-8f8101625e1a"; 
  }

  console.log("📌 CIRCLE_USDC_TOKEN_ID:", usdcTokenId);

  // 4. Append to .env file
  appendFileSync(
    ".env",
    `\nCIRCLE_AGENT_WALLET_ID=${wallet.id}\nCIRCLE_USDC_TOKEN_ID=${usdcTokenId}\n`
  );

  console.log("\n🎉 Saved both IDs to your .env file!");
  console.log(`\n💡 Next step: Fund your test wallet with USDC on Base Sepolia!`);
  console.log(`   Public Address: ${wallet.address}`);
  console.log(`   Faucet: https://faucet.circle.com/`);
}

export default setupWallet;