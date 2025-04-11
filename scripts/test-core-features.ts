import fetch from 'node-fetch';

async function testCoreFeatures() {
  try {
    console.log('Testing subscription API...');
    const subscriptionRes = await fetch('http://localhost:3000/api/subscriptions');
    console.log(`Status: ${subscriptionRes.status}`);

    console.log('Testing analytics API...');
    const analyticsRes = await fetch('http://localhost:3000/api/analytics?organizationId=test-org');
    console.log(`Status: ${analyticsRes.status}`);

    // ...add more API tests as needed
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testCoreFeatures();
