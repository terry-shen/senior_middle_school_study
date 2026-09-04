// Test AI analysis to see actual error from analyzeQuestion
async function main() {
  // Login
  const login = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'admin1', password: 'admin123' }),
  });
  const loginData = await login.json();
  const token = loginData.token;
  console.log('Logged in:', loginData.student?.studentId);

  // Call analyze question 1
  console.log('\nCalling POST /api/analysis/question/1...');
  try {
    const resp = await fetch('http://localhost:3000/api/analysis/question/1', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const text = await resp.text();
    console.log('Status:', resp.status);
    console.log('Body:', text.slice(0, 500));
  } catch (e) {
    console.log('Fetch error:', e.message);
  }
}
main().catch(console.error);
