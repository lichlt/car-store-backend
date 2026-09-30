const { execSync, spawn } = require("child_process");
const net = require("net");

function runCmd(command, ignoreError = false) {
  try {
    execSync(command, { stdio: "inherit" });
    return true;
  } catch (err) {
    if (!ignoreError) {
      console.error(`❌ Command failed: ${command}`);
    }
    return false;
  }
}

function checkPort(port, host = "127.0.0.1", timeout = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let connected = false;

    socket.setTimeout(timeout);
    socket.once("connect", () => {
      connected = true;
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitForDb(maxRetries = 20, delayMs = 1000) {
  console.log("⏳ Checking PostgreSQL database connection on port 5432...");
  for (let i = 1; i <= maxRetries; i++) {
    const isReady = await checkPort(5432);
    if (isReady) {
      console.log("✅ PostgreSQL is ready!\n");
      return true;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  console.warn(
    "⚠️ Could not connect to PostgreSQL within timeout. Attempting to proceed...\n",
  );
  return false;
}

async function main() {
  console.log("====================================================");
  console.log("🚀 CarStore Backend - All-In-One Startup");
  console.log("====================================================\n");

  // Step 1: Start Docker containers (PostgreSQL, Redis, PgAdmin)
  console.log("📦 Step 1: Starting Docker services (Postgres & Redis)...");
  const dockerStarted = runCmd("docker compose up -d", true);
  if (!dockerStarted) {
    console.log(
      "ℹ️  Docker not available or already running. Checking connection...\n",
    );
  }

  // Step 2: Wait for database readiness
  await waitForDb();

  // Step 3: Run migrations (idempotent - skips already executed migrations)
  console.log("🔄 Step 2: Running TypeORM migrations...");
  runCmd("npm run migration:run", true);

  // Step 4: Run seeds (idempotent - skips existing admin and data)
  console.log(
    "\n🌱 Step 3: Ensuring initial seed data (Roles, Permissions, Admin)...",
  );
  runCmd("npm run seed", true);

  // Step 5: Start NestJS development server
  console.log(
    "\n⚡ Step 4: Starting NestJS development server (watch mode)...",
  );
  const child = spawn("npm run start:dev", {
    stdio: "inherit",
    shell: true,
  });

  child.on("close", (code) => {
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
