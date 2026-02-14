// backend/scripts/test-live.ts

const API_URL = "http://localhost:4000";
const TEST_EMAIL = `test_${Date.now()}@recovery.com`;
const TEST_PASSWORD = "Password123!Secure";

async function testLive() {
  console.log(`🔌 [TEST-LIVE] Target: ${API_URL}`);
  console.log(`👤 [TEST-LIVE] Creating User: ${TEST_EMAIL}`);

  try {
    // 1. SIGNUP
    const signupRes = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, role: "PATIENT" })
    });

    if (signupRes.status !== 201) {
      const err = await signupRes.json();
      console.error("❌ [FAIL] Signup failed:", err);
      process.exit(1);
    }
    console.log("✅ [PASS] Signup successful (201 Created)");

    // 2. LOGIN (Get Token)
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
    });

    const loginData = await loginRes.json() as any; // Cast to any to access token

    if (!loginData.token) {
      console.error("❌ [FAIL] Login failed - No token returned:", loginData);
      process.exit(1);
    }
    console.log("✅ [PASS] Login successful. Token received.");

    // 3. SECURE ACCESS (Get Profile)
    // This tests the 'requireAuth' middleware and Token Versioning
    const profileRes = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      headers: { 
        "Authorization": `Bearer ${loginData.token}`
      }
    });

    if (profileRes.status !== 200) {
      console.error("❌ [FAIL] Profile fetch failed:", await profileRes.text());
      process.exit(1);
    }

    const profile = await profileRes.json() as any;
    console.log(`✅ [PASS] Authenticated Profile Access: ${profile.email}`);
    console.log("\n🔌 [TEST-LIVE] Result: PASSED. The API is healthy.");

  } catch (err) {
    console.error("❌ [FAIL] Network/Script Error:", err);
  }
}

testLive();