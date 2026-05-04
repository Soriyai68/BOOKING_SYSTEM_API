const { exec, execSync } = require("child_process");
const http = require("http");
require("dotenv").config();

const PORT = parseInt(process.env.PORT || 8080, 10);

(async function () {
  try {
    console.log("--- Starting Ngrok Tunnel ---");

    // Forcefully kill any existing ngrok processes (Windows)
    try {
      console.log("Cleaning up existing ngrok sessions...");
      execSync("taskkill /f /im ngrok.exe", { stdio: "ignore" });
    } catch (e) {}

    console.log(`Starting ngrok daemon on port ${PORT}...`);
    // Spawn ngrok in the background
    exec(`npx ngrok http ${PORT}`);
    
    // Wait for the tunnel to establish
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Fetch the tunnel URL from the ngrok API
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const tunnel = parsed.tunnels.find(t => t.proto === 'https');
          if (tunnel) {
            const url = tunnel.public_url;
            console.log(`\n✅ Ngrok tunnel established!`);
            console.log(`🚀 Public URL: ${url}`);
            console.log(`-----------------------------`);
            console.log(`\nNext steps:`);
            console.log(`1. Update VITE_API_BASE_URL in frontend .env to: ${url}/api`);
            console.log(`2. Update CORS_ORIGIN in backend env.js to: ${url}`);
            console.log(`\nPress Ctrl+C to stop the tunnel.`);
          } else {
            console.error("❌ Tunnel not found in API response. Are you sure ngrok started?");
            process.exit(1);
          }
        } catch (e) {
          console.error("❌ Error parsing ngrok API response:", e);
          process.exit(1);
        }
      });
    }).on('error', (err) => {
      console.error("\n❌ Could not connect to ngrok API. Make sure ngrok started properly.", err.message);
      process.exit(1);
    });

    // Keep the process alive
    process.on('SIGINT', () => {
      try {
        execSync("taskkill /f /im ngrok.exe", { stdio: "ignore" });
      } catch (e) {}
      process.exit(0);
    });

  } catch (err) {
    console.error("\n❌ Error starting ngrok:", err.message || err);
    process.exit(1);
  }
})();
