import { randomBytes } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";
import "dotenv/config";

const apiKey: string = process.env.CIRCLE_API_KEY || "";

if (!apiKey) {
  console.error("Error: CIRCLE_API_KEY is missing from your .env file!");
  process.exit(1);
}

async function registerEntitySecret() {
  // 1. Generate a valid 32-byte hex entity secret (64 characters long)
  const entitySecret = randomBytes(32).toString("hex");
  console.log("📡 Registering Enti  ty Secret with Circle...");

  try {
    // 2. Register secret with Circle
    const response = await registerEntitySecretCiphertext({
      apiKey,
      entitySecret,
    });

    console.log("Entity secret registered successfully!");

    // 3. Save recovery file
    if (response.data?.recoveryFile) {
      writeFileSync("recovery_file.dat", response.data.recoveryFile);
    }

    // 4. Save entity secret to .env
    appendFileSync(".env", `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`);

  } catch (error: any) {
    console.error("Registration failed:", error.message || error);
  } finally {
    return true;
  }
}

export default registerEntitySecret;