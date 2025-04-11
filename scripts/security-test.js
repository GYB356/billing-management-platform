const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Try to find ZAP in common installation locations
function findZapPath() {
  const possiblePaths = [
    process.env.ZAP_PATH,
    'C:\\Program Files\\OWASP\\ZAP\\zap-cli.bat',
    'C:\\Program Files (x86)\\OWASP\\ZAP\\zap-cli.bat',
    '/usr/local/bin/zap-cli',
    '/usr/bin/zap-cli',
    path.join(os.homedir(), '.local/bin/zap-cli'),
  ];

  for (const zapPath of possiblePaths) {
    if (zapPath && fs.existsSync(zapPath)) {
      return zapPath;
    }
  }
  return null;
}

const ZAP_PATH = findZapPath();
const REPORT_PATH = path.join(__dirname, '../reports/security');

// Ensure reports directory exists
if (!fs.existsSync(REPORT_PATH)) {
  fs.mkdirSync(REPORT_PATH, { recursive: true });
}

function runSecurityTest() {
  if (!ZAP_PATH) {
    console.error('Error: OWASP ZAP is not installed or not found in common locations.');
    console.error('Please install OWASP ZAP from: https://www.zaproxy.org/download/');
    console.error('Or set the ZAP_PATH environment variable to point to your ZAP installation.');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(REPORT_PATH, `security-report-${timestamp}.html`);

  console.log('Starting security tests...');
  console.log(`Using ZAP at: ${ZAP_PATH}`);
  console.log(`Report will be saved to: ${reportFile}`);

  const command = `"${ZAP_PATH}" quick-scan --self-contained --start-options "-config api.disablekey=true" --spider -r http://localhost:3000 --report "${reportFile}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('Error running security tests:', error);
      console.error('Make sure:');
      console.error('1. OWASP ZAP is properly installed');
      console.error('2. The application is running on http://localhost:3000');
      console.error('3. You have sufficient permissions to run ZAP');
      process.exit(1);
    }

    console.log('Security tests completed successfully');
    console.log('Test output:', stdout);
    if (stderr) {
      console.error('Test errors:', stderr);
    }
  });
}

runSecurityTest(); 