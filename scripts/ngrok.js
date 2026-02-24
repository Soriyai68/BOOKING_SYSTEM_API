const ngrok = require("ngrok");
const { execSync } = require("child_process");
require("dotenv").config();

const PORT = process.env.PORT || 8080;

(async function () {
  try {
    console.log("--- Starting Ngrok Tunnel ---");

    // Forcefully kill any existing ngrok processes (Windows)
    try {
      console.log("Cleaning up existing ngrok sessions...");
      execSync("taskkill /f /im ngrok.exe", { stdio: "ignore" });
    } catch (e) {
      // Process was not running, which is fine
    }

    // Simple connect
    const url = await ngrok.connect(PORT);

    console.log(`\n✅ Ngrok tunnel established!`);
    console.log(`🚀 Public URL: ${url}`);
    console.log(`-----------------------------`);
    console.log(`\nNext steps:`);
    console.log(`1. Update VITE_API_BASE_URL in frontend .env to: ${url}/api`);
    console.log(`2. Update CORS_ORIGIN in backend env.js to: ${url}`);
    console.log(`\nPress Ctrl+C to stop the tunnel.`);
  } catch (err) {
    console.error("\n❌ Error starting ngrok:", err.message || err);
    console.log("\nTroubleshooting:");
    console.log(
      "If you have another terminal running ngrok, please close it manually first.",
    );
    process.exit(1);
  }
})();
