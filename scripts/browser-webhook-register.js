// Manual Webhook Registration via Browser Console
// Copy and paste this entire script into your browser console while on the Shopify admin

(async function() {
  console.log('🔧 Manual Webhook Registration Script');
  console.log('=====================================\n');
  
  const shop = 'sectionappblocks.myshopify.com';
  const appUrl = 'https://cartuplift.vercel.app';
  
  try {
    // Get session token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionToken = urlParams.get('id_token');
    
    if (!sessionToken) {
      console.error('❌ No session token found in URL');
      console.log('Make sure you run this from within the CartUplift app iframe');
      return;
    }
    
    console.log('✅ Session token found');
    console.log('\n📡 Calling webhook setup endpoint...');
    
    // Call our setup endpoint
    const response = await fetch(`${appUrl}/admin/setup-webhooks?${urlParams.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('📥 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Result:', result);
    
    if (result.success) {
      console.log('\n🎉 SUCCESS! Webhook registered!');
      console.log('📋 Verification:');
      console.log('Visit: https://admin.shopify.com/store/sectionappblocks/settings/notifications/webhooks');
    } else {
      console.error('\n❌ Failed:', result.error || result);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure you are running this from the CartUplift app page');
    console.log('2. Check that the URL has id_token parameter');
    console.log('3. Try refreshing the page and running again');
  }
})();
