const express = require('express');
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
    const app = express();

    app.get(['/', '/chart'], (req, res) => {
        const filePath = path.join(__dirname, '..', 'bin', 'html', 'chart.html');
        res.sendFile(filePath, (err) => {
            if (err) {
                res.status(500).send('Error loading chart.html');
            }
        });
    });

    const serverPromise = new Promise((resolve, reject) => {
        server = app.listen(PORT, () => {
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
        
        await page.setViewport({ width: 1280, height: 720 });
        
        await page.goto(`http://localhost:${PORT}?symbol=${symbol}`, { 
            waitUntil: 'networkidle2' 
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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