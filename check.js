const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Capture and log all console messages
    page.on('console', msg => {
        console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    
    // Capture uncaught exceptions
    page.on('pageerror', error => {
        console.log(`[BROWSER ERROR]: ${error.message}`);
    });

    console.log('Navigating to http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 10000 }).catch(e => console.log(e));
    
    // Wait a couple of seconds to ensure everything has booted
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await browser.close();
})();
