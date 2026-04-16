const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Set viewport to mobile portrait size used in game
    await page.setViewport({ width: 480, height: 854 });
    
    console.log('Navigating to http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Wait a little for rendering
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await page.screenshot({ path: 'screenshot_menu.png' });
    
    console.log('Screenshot saved to screenshot_menu.png');
    
    await browser.close();
})();
