const puppeteer = require("puppeteer");
const express = require("express");
const fs = require("fs");
const { JSDOM } = require("jsdom");
const path = require("path");

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const portData = require('../models/portfolioUserData');

/**
 * @param {Array<{ date: string, value: number }>} data
 * @param {Date} [now]
 * @returns {{ date: Date, label: string }[]}
 */
function buildAxisX(data, now = new Date()) {
  if (!data || data.length === 0) return [];

  const MS_90_DAYS = 90 * 24 * 60 * 60 * 1000;

  const timestamps = data.map(d => new Date(d.date).getTime());
  const dataStart = new Date(Math.min(...timestamps));
  const dataEnd   = new Date(Math.max(...timestamps));

  const effectiveStart = (now - dataStart) > MS_90_DAYS
    ? new Date(now.getTime() - MS_90_DAYS)
    : dataStart;

  const diffHours = (dataEnd - effectiveStart) / (1000 * 60 * 60);

  let intervalHours;
  let roundTo;

  if (diffHours <= 24) {
    intervalHours = 3;
    roundTo = 3;
  } else if (diffHours <= 72) {
    intervalHours = 6;
    roundTo = 6;
  } else if (diffHours <= 168) {
    intervalHours = 12;
    roundTo = 12;
  } else if (diffHours <= 720) {
    intervalHours = 48;
    roundTo = 24;
  } else {
    intervalHours = 168;
    roundTo = 24;
  }

  const firstTick = new Date(effectiveStart);
  firstTick.setMinutes(0, 0, 0);

  const h = firstTick.getHours();
  const nextRoundHour = Math.ceil(h / roundTo) * roundTo;
  firstTick.setHours(nextRoundHour);

  const axisX = [];
  for (let i = 0; i < 13; i++) {
    const tick = new Date(firstTick.getTime() + i * intervalHours * 60 * 60 * 1000);
    axisX.push({ date: tick, label: formatTickLabel(tick, intervalHours) });
  }

  return axisX;
}

function formatTickLabel(tick, intervalHours) {
  const tickHour = tick.getHours();
  const tickMin  = tick.getMinutes();
  const isStartOfDay = tickHour === 0 && tickMin === 0;

  if (intervalHours >= 48) {
    return tick.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Bangkok',
    });
  }

  if (isStartOfDay) {
    return tick.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Bangkok',
    });
  }

  return tick.toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  });
}



async function capturePortfolio(interaction) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'bin', 'html', 'port.html'), 'utf-8');
  const css  = fs.readFileSync(path.join(__dirname, '..', 'bin', 'css', 'style.css'),  'utf-8');

  const dom = new JSDOM(html);
  const doc = dom.window.document;

  /* // ! Requirer Data
  ? Profile ---------------
  ? Username
  ? Rank
  ? XP
  ? Level
  ? Create Date

  ? Value of Assets 
  ? Profit of All assets All time - 1000(Base money)
  ? Unrealized profit - profit from holding assets
  ? Yield Return in 1 Year ago
  ? Dividend WIP

  */

  // ! User database
  const query = { userId: interaction.user.id }
  let userData = await portData.findOne(query);

  // ? Profile and XP zone
  let xp = userData.xp;
  let level = userData.level;
  let totalXp = 0;
  let ranking = '';
  let profileUsername = interaction.user.username;
  let nextLevelXp = (lv) => Math.floor(50 * (1.2 * lv) * (1.005.toExponential(lv)));

  totalXp = nextLevelXp(level);

  const formattedDate = dayjs(userData.time)
    .tz('Asia/Bangkok')
    .format('HH:mm, DD MMM YYYY');


  if (level >= 50) {
    ranking = 'Professional';
  }
  else if (level >= 25 && level < 50) {
    ranking = 'Trader';
  }
  else if (level >= 10 && level < 25) {
    ranking = 'Intermediate'
  } else {
    ranking = 'Newbie';
  }

  const avatarImg = doc.querySelector('.avatar img');
  avatarImg.src = interaction.user.displayAvatarURL();
  
  const userName = doc.querySelector('.username');
  userName.innerHTML = profileUsername;

  const rankName = doc.querySelector('.rank-name');
  rankName.innerHTML = ranking;

  const rankLevel = doc.querySelector('.rank-level');
  rankLevel.innerHTML = `LV.${level}`;

  const xpLevel = doc.querySelector('.xp-text');
  xpLevel.innerHTML = `${xp} / ${totalXp}`;

  const xpBarFill = doc.querySelector('.xp-bar-fill');
  xpBarFill.style.width = `${xp/totalXp * 100}%`;

  const timeCreate = doc.querySelector('.time-create');
  timeCreate.innerHTML = `Create at ⏰ ${formattedDate} ICT`;


  // ? portfolio header
  const portValue = doc.querySelector('.portfolio-value');
  portValue.innerHTML = '$1,234.23';

  const portChange = doc.querySelector('.portfolio-change-all');
  portChange.innerHTML = '+$52.22';

  const portChangeAllTime = doc.querySelector('.portfolio-change-all-time');
  portChangeAllTime.innerHTML = '(1.23% All Time)';

  // ? portfolio header right
  const profitValue = doc.querySelectorAll('.stat-value');
  profitValue[0].innerHTML = '$9,999.99'; // Profit
  profitValue[1].innerHTML = '5.00%';     // Yield%
  profitValue[2].innerHTML = '$0.00';   // Dividend

  const statSub = doc.querySelectorAll('.stat-sub');
  statSub[0].innerHTML = `Today +$85.23 (9.23%)`; // Profit 1D %
  statSub[2].innerHTML = `0.00% (1Y) WIP`; // Dividend %


  // ? Assets Ratio
  let stockRatio = 0.58;
  let etfRatio = 0.12;
  let cryptoRatio = 0.1;
  let goldRatio = 0.1;
  let cashRatio = 0.1

  const legendPct = doc.querySelectorAll('.legend-pct');
  legendPct[0].innerHTML = `${(stockRatio * 100).toFixed(1)}%`; // Stock
  legendPct[1].innerHTML = `${(etfRatio * 100).toFixed(1)}%`; // Etf
  legendPct[2].innerHTML = `${(cryptoRatio * 100).toFixed(1)}%`; // Crypto
  legendPct[3].innerHTML = `${(goldRatio * 100).toFixed(1)}%`; // Gold
  legendPct[4].innerHTML = `${(cashRatio * 100).toFixed(1)}%`; // Cash

  const pieTotalValue = doc.querySelector('.pie-total');
  pieTotalValue.innerHTML = '$1.23K';

  // ? Pie Chart
  const circumference = 490.09; // R=78
  const stockDash = circumference * stockRatio;
  const etfDash = circumference * etfRatio;
  const cryptoDash = circumference * cryptoRatio;
  const goldDash = circumference * goldRatio;
  const cashDash = circumference * cashRatio;

  const pieStock = doc.querySelector('.pie-stock');
  const pieEtf = doc.querySelector('.pie-etf');
  const pieCrypto = doc.querySelector('.pie-crypto');
  const pieGold = doc.querySelector('.pie-gold');
  const pieCash = doc.querySelector('.pie-cash');

  pieStock.setAttribute('stroke-dasharray', `${stockDash} ${circumference}`);
  pieStock.setAttribute('stroke-dashoffset', '0');

  pieCrypto.setAttribute('stroke-dasharray', `${cryptoDash} ${circumference}`);
  pieCrypto.setAttribute('stroke-dashoffset', `${-stockDash}`);

  pieEtf.setAttribute('stroke-dasharray', `${etfDash} ${circumference}`);
  pieEtf.setAttribute('stroke-dashoffset', `${-(stockDash + cryptoDash)}`);

  pieGold.setAttribute('stroke-dasharray', `${goldDash} ${circumference}`);
  pieGold.setAttribute('stroke-dashoffset', `${-(stockDash + cryptoDash + etfDash)}`);

  pieCash.setAttribute('stroke-dasharray', `${cashDash} ${circumference}`);
  pieCash.setAttribute('stroke-dashoffset', `${-(stockDash + cryptoDash + etfDash + goldDash)}`);

  // ? Transcation History
  let symbol = '';
  let statsTrans = ''; // buy sell div
  let transPayload = `
    <div class="txn-item sell">
      <div class="txn-left">
        <span class="txn-ticker">NVDA</span>
        <span class="txn-detail">-0.152456 Shares (4 Jun 2026)</span>
      </div>
      <div class="txn-right">
        <span class="txn-amount positive">+$23.12</span>
        <span class="txn-badge sell">Sell</span>
      </div>
    </div>
  `;

  const txnList = doc.querySelector('.txn-list');
  txnList.replaceChildren(); // ! if have transaction
  txnList.innerHTML += transPayload;

  // ? Top Assets
  let payloadAssets = `
    <div class="asset-row-item assets-master-grid-layout">
        <div class="asset-main-info">
            <img class="asset-icon" src="https://img.logo.dev/ticker/NVDA?token=pk_fwZXSnJzRW6AO037_JMVkg&retina=true">
            <div>
                <div class="asset-name">NVDA</div>
                <div class="asset-full">NVIDIA Corp.</div>
            </div>
        </div>
        <div class="asset-data-cell asset-price-text text-muted-cell">$1,208.45</div>
        <div class="asset-data-cell asset-volume-text text-muted-cell">12.256487</div>
        <div class="asset-data-cell asset-value-text text-muted-cell">$42,850</div>
        <div class="asset-data-cell asset-change-text change-positive">+3.24%</div>
        <div class="asset-data-cell asset-profit change-negative">
          <div class="asset-profit-text">-$232.12</div>
          <div class="asset-profit-pct">(-23.45%)</div>
        </div>
        <div class="asset-data-cell">
            <div class="alloc-bar-wrap">
                <span class="text-muted-cell alloc-text" style="font-family:'JetBrains Mono',monospace;">27.4%</span>
                <div class="alloc-bar-bg"><div class="alloc-bar-fill" style="width:27%;background:#76b900;"></div></div>
            </div>
        </div>
    </div>
  `;

  const assetList = doc.querySelector('.asset-list-container');
  // assetList.replaceChildren();
  // assetList.innerHTML += payloadAssets;

  const symbolName = doc.querySelectorAll('.asset-name');
  const symbolFullName = doc.querySelectorAll('.asset-full');
  const symbolLogo = doc.querySelectorAll('.asset-icon');

  const priceText = doc.querySelectorAll('.asset-price-text');
  const volumeText = doc.querySelectorAll('.asset-volume-text');
  const valueText = doc.querySelectorAll('.asset-value-text');
  const changeText = doc.querySelectorAll('.asset-change-text');
  const profitText = doc.querySelectorAll('.asset-profit-text');
  const profitPct = doc.querySelectorAll('.asset-profit-pct');
  const allocText = doc.querySelectorAll('.alloc-text');
  const allocBar = doc.querySelectorAll('.alloc-bar-fill');

  // Example
  priceText[0].innerHTML = '$124.23';
  priceText[1].innerHTML = '$324.83';

  allocText[0].innerHTML = '65.2%';
  allocText[1].innerHTML = '34.8';
  allocBar[0].style.width = '65.2%';
  allocBar[1].style.width = '34.8%';

  
  // ? Graph
  let minValue = 500;
  let maxValue = 2000;
  let axisY = [];
  let axisYRaw = [];

  minValue *= 0.92;
  maxValue *= 1.08;

  // ? Y - Axis
  function niceStep(min, max, steps) {
    const rawStep = (max - min) / steps;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const nice = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
    const niceStep = nice.find(n => n * magnitude >= rawStep) * magnitude;
    return niceStep;
  }

  function formatAxisLabel(value) {
    if (value >= 1_000_000_000) return '$' + (value / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (value >= 1_000_000)     return '$' + (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (value >= 100_000)       return '$' + (value / 1_000).toFixed(0).replace(/\.0$/, '') + 'K';
    if (value >= 10_000)        return '$' + (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    if (value >= 1_000)         return '$' + (value / 1_000).toFixed(2).replace(/\.0$/, '') + 'K';
    return '$' + value.toString();
  }

  const step = niceStep(minValue, maxValue, 6);
  for (let i = 0; i < 7; i++) {
    axisY.push(Math.round(minValue / step) * step + step * i);
    axisYRaw.push(Math.round(minValue / step) * step + step * i);
  }
  
  axisY = axisY.map(formatAxisLabel);
  const chartY = doc.querySelectorAll('.chart-label-y');
  for (let i = 0; i < 7; i++) {
    chartY[i].innerHTML = axisY[i];
  }


  // ? X - Axis
  let startDate = '2026-06-01T16:45:00.000Z';
  let endDate = '2026-06-02T18:30:00.000Z';
  let createPortDate = '2026-06-03T18:00:00.000Z';
  let dateNow = new Date()

  startDate = new Date(startDate);
  endDate = new Date(endDate);
  createPortDate = new Date(createPortDate);

  let axisX = [];
  let chartArray = []; // 'x,y' '50-1400, 0-340'
  let chartArrayX = []; // 'x'
  let chartArrayY = []; // 'y'

  const mapRange = (value, inMin, inMax, outMin, outMax, clamp = false) => {
    const mapped = ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
    if (!clamp) return mapped;
    return Math.min(Math.max(mapped, outMin), outMax);
  };


  const mockData = [
    { date: '2026-06-06T01:00:00.000Z', value: 1354 },
    { date: '2026-06-06T02:00:00.000Z', value: 1025 },
    { date: '2026-06-06T03:00:00.000Z', value: 1254 },
    { date: '2026-06-06T04:00:00.000Z', value: 1756 },
    { date: '2026-06-06T05:00:00.000Z', value: 1012 },
    { date: '2026-06-06T06:00:00.000Z', value: 1542 },
    { date: '2026-06-06T07:00:00.000Z', value: 1392 },
    { date: '2026-06-06T08:00:00.000Z', value: 1642 },
    { date: '2026-06-06T09:00:00.000Z', value: 1942 },
    { date: '2026-06-06T10:00:00.000Z', value: 1202 },
  ];

  axisX = buildAxisX(mockData);
  // console.log(axisX);

  // test
  const axisStart = new Date(axisX[0].date);
  const axisEnd = new Date(axisX[12].date);
  const totalTimeM = (axisEnd - axisStart) / (1000 * 60);

  for (let i = 0; i < mockData.length; i++) {
    const mockTime = new Date(mockData[i].date);

    if (mockTime < axisStart || mockTime > axisEnd) continue;
    const mockValue = mockData[i].value;

    const diffTimeM = (mockTime - axisStart) / (1000 * 60);

    const timeX = mapRange(diffTimeM, 0, totalTimeM, 50, 1460, false);
    const valueY =  300 - mapRange(mockValue, axisYRaw[0], axisYRaw[6], 0, 300, true);

    chartArray.push(`${timeX.toFixed(2)},${valueY.toFixed(2)}`);
    chartArrayX.push(`${timeX.toFixed(2)}`);
    chartArrayY.push(`${valueY.toFixed(2)}`);
  }


  // console.log(chartArray.join(' ').trim());
  // console.log(chartArray);
  // console.log(totalTimeM);

  const chartX = doc.querySelectorAll('.chart-label-x');
  for (let i = 0; i < 13; i++) {
    chartX[i].innerHTML = axisX[i].label;
  }

  // ! Graph SVG
  const chartSVG = doc.querySelector('.chart-svg-line');
  chartSVG.setAttribute('d', `M${chartArray.join(' ').trim()}`);

  const chartSVGglow = doc.querySelector('.chart-svg-glow');
  chartSVGglow.setAttribute('d', `M${chartArray.join(' ').trim()}L${chartArrayX[chartArray.length - 1]},300 L${chartArrayX[0]},300 Z`);

  // ! Cursor
  const cursor = doc.querySelectorAll('.cursor-svg');
  cursor[0].setAttribute('cx', chartArrayX[chartArray.length - 1]);
  cursor[0].setAttribute('cy', chartArrayY[chartArray.length - 1]);
  
  cursor[1].setAttribute('cx', chartArrayX[chartArray.length - 1]);
  cursor[1].setAttribute('cy', chartArrayY[chartArray.length - 1]);


  // ? Server
  const linkEl = doc.querySelector('link[rel="stylesheet"]');
  const styleEl = doc.createElement("style");
  styleEl.textContent = css;
  linkEl.replaceWith(styleEl);

  const modifiedHtml = dom.serialize();
  const app = express();

  app.use("/fonts", express.static(path.join(__dirname, "..", "bin", "fonts")));
  app.get("/", (req, res) => res.send(modifiedHtml));

  const server = app.listen(3099);

  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

  await page.goto("http://localhost:3099", { waitUntil: "networkidle2" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(resolve => setTimeout(resolve, 500));

  const screenshot = await page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: 1920, height: 1080 },
  });

  await browser.close();
  server.close();
  
  console.log('done');
  fs.writeFileSync("output.png", screenshot); // เพิ่มบรรทัดนี้

  return screenshot;
}

// capturePortfolio();

module.exports = { capturePortfolio };