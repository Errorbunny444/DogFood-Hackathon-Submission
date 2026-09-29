const baseUrl = process.env.API_BASE_URL || 'http://localhost:8080';

async function checkHealth() {
  try {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    if (!res.ok) {
      console.error(`Healthcheck failed: HTTP ${res.status}`);
      process.exit(1);
    }
    const data = await res.json();
    console.log('Healthcheck OK:', data);
    process.exit(0);
  } catch (err) {
    console.error('Healthcheck error:', err);
    process.exit(1);
  }
}

checkHealth();
