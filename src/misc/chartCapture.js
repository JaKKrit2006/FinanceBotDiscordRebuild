const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

/**
 * @param {string} symbol
 * @returns {Promise<Buffer>}
 */
async function generateChartBuffer(symbol = 'AAPL') {
    const PORT = 3000;
    let server;

    const serverPromise = new Promise((resolve, reject) => {
        server = http.createServer((req, res) => {
            const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
            
            if (reqUrl.pathname === '/' || reqUrl.pathname === '/chart') {
                fs.readFile(path.join(__dirname, '..', 'bin', 'html', 'chart.html'), (err, content) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error loading chart.html');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content);
                    }
                });
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        server.listen(PORT, () => {
            resolve();
        });

        server.on('error', (err) => {
            reject(err);
        });
    });

    try {
        await serverPromise;

        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        await page.setViewport({ width: 1920, height: 1080 });
        
        await page.goto(`http://localhost:${PORT}?symbol=${encodeURIComponent(symbol)}`, { 
            waitUntil: 'networkidle2' 
        });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        const imageBuffer = await page.screenshot({ encoding: 'binary' });
        
        await browser.close();
        await new Promise((resolve) => server.close(resolve));

        return imageBuffer;

    } catch (error) {
        if (server && server.listening) {
            await new Promise((resolve) => server.close(resolve));
        }
        throw error;
    }
}

module.exports = { generateChartBuffer };