const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 480, height: 854 });
    
    page.on('pageerror', error => {
        console.log(`[PAGE ERROR] ${error.stack}`);
    });
    page.on('console', msg => {
        if(msg.type() === 'error') console.log(`[JS ERROR] ${msg.text()}`);
    });

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Click PLAY button via Enter key
    await page.keyboard.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await page.screenshot({ path: 'screenshot_game.png' });
    console.log('Game scene screenshot saved.');
    
    await browser.close();
})();
