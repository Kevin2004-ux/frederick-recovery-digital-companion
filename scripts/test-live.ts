// app/backend/scripts/test-live.ts
// No import needed for Node 18+!

const API_URL = "https://frederick-backend.onrender.com";
const EMAIL = `test_${Date.now()}@example.com`;
const PASSWORD = "Password123!";

async function run() {
  console.log(`\n🚀 Starting Live Test against ${API_URL}...\n`);

  // 1. HEALTH CHECK
  console.log("1. Testing Health Check...");
  try {
    const health = await fetch(`${API_URL}/health`);
    if (health.status !== 200) throw new Error(`Health check failed: ${health.status}`);
    console.log("✅ Health Check passed");
  } catch (e) {
    console.error("❌ Health Check failed. Is the server running?");
    process.exit(1);
  }

  // 2. REGISTER
  console.log("\n2. Testing Registration...");
  const regRes = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  
  const regData = await regRes.json() as any;
  
  if (regRes.status !== 201) {
    console.error("❌ Registration failed:", regData);
    process.exit(1);
  }
  console.log("✅ Registration passed. User ID:", regData.id);

  // 3. LOGIN
  console.log("\n3. Testing Login...");
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginData = await loginRes.json() as any;

  if (loginRes.status !== 200) {
    console.error("❌ Login failed:", loginData);
    process.exit(1);
  }

  const token = loginData.token;
  console.log("✅ Login passed. Token received.");

  // 4. GET PROFILE
  console.log("\n4. Testing Protected Route (/auth/me)...");
  const meRes = await fetch(`${API_URL}/auth/me`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const meData = await meRes.json() as any;

  if (meRes.status !== 200) {
    console.error("❌ Get Profile failed:", meData);
    process.exit(1);
  }
  
  // FIXED: The controller returns the profile object directly, not wrapped in 'user'
  // If meData has 'email', use it. If it wraps it in 'user', use that.
  const email = meData.email || meData.user?.email;
  
  if (!email) {
      console.error("❌ Profile data malformed:", meData);
      process.exit(1);
  }

  console.log("✅ Profile fetched:", email);
  console.log("\n🎉 ALL SYSTEMS GO. Backend is working!");
}

run().catch(console.error);