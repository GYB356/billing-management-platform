import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

function generateVapidKeys() {
  try {
    console.log('Generating VAPID keys for web push notifications...');
    
    const vapidKeys = webpush.generateVAPIDKeys();
    
    const envContent = `
# Web Push VAPID Keys
VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
`;

    // Append to .env file if it exists, create if it doesn't
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      fs.appendFileSync(envPath, envContent);
    } else {
      fs.writeFileSync(envPath, envContent.trim());
    }

    // Also append to .env.example to document the required variables
    const envExamplePath = path.join(process.cwd(), '.env.example');
    if (fs.existsSync(envExamplePath)) {
      fs.appendFileSync(envExamplePath, `
# Web Push VAPID Keys
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
`);
    }

    console.log('✅ VAPID keys generated successfully!');
    console.log('Public Key:', vapidKeys.publicKey);
    console.log('Private Key:', vapidKeys.privateKey);
    console.log('\nKeys have been added to your .env file');
    console.log('Make sure to keep these keys secure and never commit them to version control.');
  } catch (error) {
    console.error('Error generating VAPID keys:', error);
    process.exit(1);
  }
}

generateVapidKeys();