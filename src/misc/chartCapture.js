const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

/**
 * @param {string} symbol
 * @returns {Promise<Buffer>}
 */
async function generateChartBuffer(symbol = 'AAPL') {
    const PORT = 8989;
    let server;
    const app = express();

    // จัดการ Route ด้วย Express
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
        // รอให้ Server เริ่มทำงาน
        await serverPromise;

        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        await page.setViewport({ width: 1280, height: 720 });
        
        await page.goto(`http://localhost:${PORT}?symbol=${encodeURIComponent(symbol)}`, { 
            waitUntil: 'networkidle2' 
        });
        
        // รอให้กราฟเรนเดอร์เสร็จ
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // ถ่ายภาพหน้าจอ
        const imageBuffer = await page.screenshot({ encoding: 'binary' });
        
        // ปิด Browser และ Server
        await browser.close();
        await new Promise((resolve) => server.close(resolve));

        // บันทึกไฟล์และคืนค่า Buffer
        fs.writeFileSync('output1.png', imageBuffer);
        return imageBuffer;

    } catch (error) {
        // จัดการปิด Server หากเกิดข้อผิดพลาด
        if (server && server.listening) {
            await new Promise((resolve) => server.close(resolve));
        }
        throw error;
    }
}

generateChartBuffer();

module.exports = { generateChartBuffer };