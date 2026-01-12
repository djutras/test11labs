const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Test the reactivation link (GET request - this is what email links use)
  const reactivateUrl = 'https://test11lab.netlify.app/api/campaigns/86a5445b-a45d-40ea-adf0-c3b480458417/reactivate-client/15145731267';

  console.log('Testing reactivation link:', reactivateUrl);

  await page.goto(reactivateUrl);
  await page.waitForTimeout(3000);

  const content = await page.content();
  console.log('\n--- Page Content ---');
  console.log(content);

  await browser.close();
})();
