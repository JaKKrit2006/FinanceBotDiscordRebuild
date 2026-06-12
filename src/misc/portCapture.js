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

// yahoo
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

function generateChartTemplate(money = 1000) {
  const now = new Date();
  const startDate = new Date();

  startDate.setHours(7, 0, 0, 0);

  if (now.getHours() < 7) {
    startDate.setDate(startDate.getDate() - 1);
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  const result = [];
  const currentPointer = new Date(startDate);

  while (currentPointer <= endDate) {
    result.push({
      date: currentPointer.toISOString(),
      close: money
    });

    currentPointer.setTime(currentPointer.getTime() + 5 * 60 * 1000);
  }

  return result;
}

const buildAxisX = (data) => {
  const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // GMT+7

  const toLocal = (date) => new Date(date.getTime() + TZ_OFFSET_MS);
  const toUTC   = (date) => new Date(date.getTime() - TZ_OFFSET_MS);

  const referenceDate = data && data.length > 0
    ? new Date(data[0].date)
    : new Date();

  const localRef = toLocal(referenceDate);
  const startLocal = new Date(localRef);
  startLocal.setUTCHours(7, 0, 0, 0);

  if (localRef < startLocal) {
    startLocal.setUTCDate(startLocal.getUTCDate() - 1);
  }

  const axis = [];

  for (let i = 0; i <= 12; i++) {
    const pointLocal = new Date(startLocal);
    pointLocal.setUTCHours(startLocal.getUTCHours() + i * 2);

    const h = pointLocal.getUTCHours();
    const m = pointLocal.getUTCMinutes();

    let label;
    label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    const pointUTC = toUTC(pointLocal);

    axis.push({
      date:  pointUTC.toISOString(),
      label,
    });
  }

  return axis;
};

function mergeSymbol(dataArray) {
  const merged = dataArray.reduce((acc, item) => {
    if (acc[item.symbol]) {
      acc[item.symbol].volume += item.volume;
      acc[item.symbol].cost += item.cost;
    } else {
      acc[item.symbol] = { ...item };
    }
    return acc;
  }, {});

  return Object.values(merged);
}


async function capturePortfolio(interaction) {
  // ? Server Header
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
  timeCreate.innerHTML = `Create at ⏰ ${formattedDate}`;

  // ? Wallpaper
  const wallpaper = userData.wallpaper;
  const bodyElement = doc.body;

  if (wallpaper[0] === 'default') {
    bodyElement.style.backgroundImage = '';
  } else {
    bodyElement.style.backgroundImage = `url('https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/image/${wallpaper[0]}.jpg')`;
  }

  // ? portfolio header
  const stockArray = userData.balance.assets?.stock ?? [];
  const etfArray   = userData.balance.assets?.etf   ?? [];
  const cryptoArray = userData.balance.assets?.crypto ?? [];
  const goldArray  = userData.balance.assets?.gold  ?? [];

  const mergeStock  = mergeSymbol(stockArray);
  const mergeEtf    = mergeSymbol(etfArray);
  const mergeCrypto = mergeSymbol(cryptoArray);
  const mergeGold   = mergeSymbol(goldArray);

  const calcTotalCost = (asset) => {
    return Math.round(asset.reduce((sum, a) => sum + (a.cost ?? 0), 0) * 100) / 100;
  };

  const SYMBOL_MAP = {
    'GOLD': 'GC=F',
  };

  const toYahooSymbol    = (symbol) => SYMBOL_MAP[symbol] ?? symbol;
  const toOriginalSymbol = (yahooSymbol) =>
    Object.keys(SYMBOL_MAP).find(k => SYMBOL_MAP[k] === yahooSymbol) ?? yahooSymbol;

  const allAssetSymbol = [
    ...mergeStock.map(a => a.symbol),
    ...mergeEtf.map(a => a.symbol),
    ...mergeCrypto.map(a => `${a.symbol}-USD`),
    ...mergeGold.map(a => toYahooSymbol(a.symbol)),
  ];

  let priceMap = {};

  if (allAssetSymbol.length > 0) {
    const rawResults = await yahooFinance.quote(allAssetSymbol);
    const results = Array.isArray(rawResults) ? rawResults : [rawResults];

    // console.log(results);

    priceMap = Object.fromEntries(
      results
        .filter(q => q?.symbol)   // กรอง null/undefined ออก
        .map(q => [toOriginalSymbol(q.symbol), {
          price:          q.regularMarketPrice      ?? 0,
          change:         q.regularMarketChange     ?? 0,
          changePct:      q.regularMarketChangePercent ?? 0,
          fiftyTwoChange: q.fiftyTwoWeekChangePercent ?? 0,
          shortName:       q.shortName ?? 'None',
        }])
    );
  }

  const calcWealth = (assets, isCrypto = false) =>
    assets.reduce((sum, asset) => {
      const key   = isCrypto ? `${asset.symbol}-USD` : asset.symbol;
      const price = priceMap[key]?.price ?? 0;
      return sum + asset.volume * price;
    }, 0);

  const calcTodayProfit = (assets, isCrypto = false) =>
    assets.reduce((sum, asset) => {
      const key    = isCrypto ? `${asset.symbol}-USD` : asset.symbol;
      const change = priceMap[key]?.change ?? 0;
      return sum + change * asset.volume;
    }, 0);

  const totalSpend =
    calcTotalCost(mergeStock) +
    calcTotalCost(mergeEtf)   +
    calcTotalCost(mergeCrypto) +
    calcTotalCost(mergeGold);

  const calcAnnualYield = (assets, isCrypto = false) => {
    if (totalSpend === 0) return 0;

    return assets.reduce((sum, asset) => {
      const key            = isCrypto ? `${asset.symbol}-USD` : asset.symbol;
      const ratio          = (asset.cost ?? 0) / totalSpend;
      const fiftyTwoChange = priceMap[key]?.fiftyTwoChange ?? 0;
      return sum + ratio * fiftyTwoChange;
    }, 0);
  };

  const stockWealth  = calcWealth(mergeStock);
  const etfWealth    = calcWealth(mergeEtf);
  const cryptoWealth = calcWealth(mergeCrypto, true);
  const goldWealth   = calcWealth(mergeGold);

  let totalWealth  = stockWealth + etfWealth + cryptoWealth + goldWealth;

  const todayProfit  =
    calcTodayProfit(mergeStock) +
    calcTodayProfit(mergeEtf)   +
    calcTodayProfit(mergeCrypto, true) +
    calcTodayProfit(mergeGold);

  const annualPctChange =
    calcAnnualYield(mergeStock) +
    calcAnnualYield(mergeEtf)   +
    calcAnnualYield(mergeCrypto, true) +
    calcAnnualYield(mergeGold);


  const formatNumber = (num) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  const moneyUser = userData.balance.money.cash;
  totalWealth = Math.round(totalWealth * 100) / 100;

  const portChangeValue = totalWealth - totalSpend;
  const startMoney = 1000;
  const valueChangeAllTime = totalWealth + moneyUser - startMoney;

  const portValue = doc.querySelector('.portfolio-value');
  portValue.innerHTML = `$${formatNumber(totalWealth + moneyUser)}`;

  const portChange = doc.querySelector('.portfolio-change');
  portChange.innerHTML = `
  <div class="portfolio-change-all">${valueChangeAllTime > 0 ? '+' : '-'}$${formatNumber(Math.abs(valueChangeAllTime))}</div>
  <div class="portfolio-change-all-time">(${(((totalWealth + moneyUser)/startMoney - 1) * 100).toFixed(2)}% All time)</div>
  `
  portChange.classList.add(valueChangeAllTime > 0 ? 'change-positive' : 'change-negative');

  // ? portfolio header right
  const profitValue = doc.querySelectorAll('.stat-value');
  profitValue[0].innerHTML = `${portChangeValue > 0 ? '' : '-'}$${formatNumber(Math.abs(portChangeValue))}`; // Profit
  profitValue[1].innerHTML = `${annualPctChange.toFixed(2)}%`;     // Yield%
  profitValue[2].innerHTML = '$0.00';           // Dividend
  profitValue[3].innerHTML = `$${moneyUser.toFixed(2)}`;   // Cash

  const statSub = doc.querySelectorAll('.stat-sub');
  statSub[0].innerHTML = `Today ${todayProfit > 0 ? '+' : '-'}$${formatNumber(Math.abs(todayProfit))} (${((totalWealth/(totalWealth - (todayProfit || 0)) - 1) * 100).toFixed(2)}%)`; // Profit 1D %
  statSub[0].classList.add(todayProfit > 0 ? 'change-positive' : 'change-negative');
  statSub[2].innerHTML = `0.00% (1Y) WIP`; // Dividend %


  // ? Assets Ratio
  let stockRatio  = stockWealth/(totalWealth + moneyUser);
  let etfRatio    = etfWealth/(totalWealth + moneyUser);
  let cryptoRatio = cryptoWealth/(totalWealth + moneyUser);
  let goldRatio   = goldWealth/(totalWealth + moneyUser);
  let cashRatio   = moneyUser/(totalWealth + moneyUser);

  const legendPct = doc.querySelectorAll('.legend-pct');
  legendPct[0].innerHTML = `${(stockRatio * 100).toFixed(1)}%`;  // Stock
  legendPct[1].innerHTML = `${(etfRatio * 100).toFixed(1)}%`;    // Etf
  legendPct[2].innerHTML = `${(cryptoRatio * 100).toFixed(1)}%`; // Crypto
  legendPct[3].innerHTML = `${(goldRatio * 100).toFixed(1)}%`;   // Gold
  legendPct[4].innerHTML = `${(cashRatio * 100).toFixed(1)}%`;   // Cash

  const pieTotalValue = doc.querySelector('.pie-total');
  pieTotalValue.innerHTML = `${formatAxisLabel(parseFloat((totalWealth + moneyUser).toFixed(2)))}`;

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

  pieStock.setAttribute('stroke-dasharray',  `${stockDash} ${circumference}`);
  pieStock.setAttribute('stroke-dashoffset', '0');

  pieEtf.setAttribute('stroke-dasharray',    `${etfDash} ${circumference}`);
  pieEtf.setAttribute('stroke-dashoffset',   `${-(stockDash)}`);

  pieCrypto.setAttribute('stroke-dasharray', `${cryptoDash} ${circumference}`);
  pieCrypto.setAttribute('stroke-dashoffset',`${-(stockDash + etfDash)}`);

  pieGold.setAttribute('stroke-dasharray',   `${goldDash} ${circumference}`);
  pieGold.setAttribute('stroke-dashoffset',  `${-(stockDash + etfDash + cryptoDash)}`);

  pieCash.setAttribute('stroke-dasharray',   `${cashDash} ${circumference}`);
  pieCash.setAttribute('stroke-dashoffset',  `${-(stockDash + etfDash + cryptoDash + goldDash)}`);

  // ? Transcation History
  const txnListData = userData.transaction;
  const txnList = doc.querySelector('.txn-list');

  if (txnListData.length !== 0) {
    txnList.replaceChildren(); // ! if have transaction

    let maxLength = txnListData.length;
    if (maxLength >= 6) {
      maxLength = 6;
    } 

    for (let i = 0; i < maxLength; i++) {
      const txnLength = txnListData.length;
      let symbol       = txnListData[txnLength - i - 1].symbol;
      let volume       = txnListData[txnLength - i - 1].volume;
      let cost         = txnListData[txnLength - i - 1].cost;
      let dateTxn      = txnListData[txnLength - i - 1].date;
      let statsTxn     = txnListData[txnLength - i - 1].type; // buy sell div
      let assetTypeTxn = txnListData[txnLength - i - 1].assetType; // buy sell div

      let assetTypeText = '';

      if (assetTypeTxn === 'stock' || assetTypeTxn === 'etf') { assetTypeText = 'Shares' };
      if (assetTypeTxn === 'crypto') { assetTypeText = 'Coins' };
      if (assetTypeTxn === 'gold') { assetTypeText = 'Oz' };

      const formattedDate = dayjs(dateTxn)
        .tz('Asia/Bangkok')
        .format('(DD MMM YYYY)');

      let transPayload = `
        <div class="txn-item ${statsTxn}">
          <div class="txn-left">
            <span class="txn-ticker">${symbol}</span>
            <span class="txn-detail">${statsTxn === 'buy' ? '+' : '-'}${volume} ${assetTypeText} ${formattedDate}</span>
          </div>
          <div class="txn-right">
            <span class="txn-amount ${statsTxn === 'buy' ? 'negative' : 'positive'}">${statsTxn === 'buy' ? '-' : '+'}$${cost}</span>
            <span class="txn-badge ${statsTxn}">${statsTxn.toUpperCase()}</span>
          </div>
        </div>
      `;

      txnList.innerHTML += transPayload;
    }
  }
  

  // ? Top Asset
  const calcWealthBySymbol = (assets, isCrypto = false) =>
    assets.map(asset => {
      const key   = isCrypto ? `${asset.symbol}-USD` : asset.symbol;
      const price = priceMap[key]?.price ?? 0;
      const name = priceMap[key]?.shortName ?? 'None';
      const change1D = priceMap[key]?.change ?? 0;
      const change1DPct = priceMap[key]?.changePct ?? 0;
      const ratio = (asset.volume * price)/totalWealth

      return {
        symbol: asset.symbol,
        value:  asset.volume * price,
        logoURL: asset.logoURL,
        shortName: name,
        marketPrice: price,
        volume: asset.volume,
        cost: asset.cost,
        change: change1D,
        changePct: change1DPct,
        ratio: ratio
      };
    });

  const allWealthBySymbol = [
    ...calcWealthBySymbol(mergeStock),
    ...calcWealthBySymbol(mergeEtf),
    ...calcWealthBySymbol(mergeCrypto, true),
    ...calcWealthBySymbol(mergeGold),
  ].sort((a, b) => b.value - a.value);

  // console.log(allWealthBySymbol);

  const assetList = doc.querySelector('.asset-list-container');

  if (allWealthBySymbol.length !== 0) {

    // ! Delete all element
    assetList.replaceChildren();

    let maxSymbol = allWealthBySymbol.length;
    if (allWealthBySymbol.length >= 5) {
      maxSymbol = 5;
    } 

    let html = '';

    for(let i = 0; i < maxSymbol; i++) {
      const value = allWealthBySymbol[i].value;
      const cost = allWealthBySymbol[i].cost
      const profit = value - cost;
      const change = allWealthBySymbol[i].change;
      const changePct = allWealthBySymbol[i].changePct;

      let payloadAssets = `
        <div class="asset-row-item assets-master-grid-layout">
            <div class="asset-main-info">
                <img class="asset-icon" src=${allWealthBySymbol[i].logoURL}>
                <div>
                    <div class="asset-name">${allWealthBySymbol[i].symbol}</div>
                    <div class="asset-full">${allWealthBySymbol[i].shortName}</div>
                </div>
            </div>
            <div class="asset-data-cell asset-price-text">$${formatNumber(allWealthBySymbol[i].marketPrice)}</div>
            <div class="asset-data-cell asset-volume-text">${allWealthBySymbol[i].volume.toFixed(7)}</div>
            <div class="asset-data-cell asset-value-text">$${formatNumber(allWealthBySymbol[i].value)}</div>
            <div class="asset-data-cell asset-change-text ${change > 0 ? 'change-positive' : 'change-negative'}">
              <div class="asset-profit-text">${change > 0 ? '+' : '-'}$${formatNumber(Math.abs(change))}</div>
              <div class="asset-profit-pct">(${changePct.toFixed(2)}%)</div>
            </div>
            <div class="asset-data-cell asset-profit ${profit > 0 ? 'change-positive' : 'change-negative'}">
              <div class="asset-profit-text">${profit > 0 ? '+' : '-'}$${formatNumber(Math.abs(profit))}</div>
              <div class="asset-profit-pct">(${((value/cost - 1) * 100).toFixed(2)}%)</div>
            </div>
            <div class="asset-data-cell">
                <div class="alloc-bar-wrap">
                    <span class="alloc-text" style="font-family:'JetBrains Mono',monospace;">${(allWealthBySymbol[i].ratio * 100).toFixed(1)}%</span>
                    <div class="alloc-bar-bg"><div class="alloc-bar-fill" style="width:${(allWealthBySymbol[i].ratio * 100).toFixed(1)}%;background:#1db954;"></div></div>
                </div>
            </div>
        </div>
      `;

      html += payloadAssets;
    }

    assetList.innerHTML = html;
  }


  // ? Graph Time
  const graphTime = doc.querySelector('.graph-time');
  graphTime.innerHTML = `⏰ ${dayjs(new Date()).tz('Asia/Bangkok').format('HH:mm, DD MMM YYYY')} ICT`;
  
  // ? Graph
  let createPortDate = userData.time;
  createPortDate = dayjs(createPortDate).tz('Asia/Bangkok').format('YYYY-MM-DD');

  const today = new Date();
  if (today.getHours() < 7) {
    today.setDate(today.getDate() - 1);
  }

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  let chartData = '';

  if (allWealthBySymbol.length === 0) {
    chartData = generateChartTemplate(moneyUser);
  }

  else {
    const queryOptions = {
      period1: `${year}-${month}-${day}`,
      interval: '5m',
    };

    const chartAllSymbol = await Promise.all(
      allAssetSymbol.map(async (symbol) => {
        try {
          const result = await yahooFinance.chart(symbol, queryOptions);
          
          if (!result || !Array.isArray(result.quotes)) {
            console.warn(`[Warning] No quotes data found for symbol: ${symbol}`);
            return { symbol, data: [] };
          }

          return {
            symbol,
            data: result.quotes
              .filter(quote => quote && quote.date !== null && quote.close !== null)
              .map(({ date, close }) => ({ date, close }))
          };

        } catch (error) {
          console.error(`[Error] Failed to fetch chart for symbol: ${symbol}`, error.message);
          return { symbol, data: [] };
        }
      })
    );

    chartData = generateChartTemplate();

    function groupAssetsBySymbol(assets) {
      const map = {};
      for (const asset of assets) {
        if (!map[asset.symbol]) map[asset.symbol] = [];
        map[asset.symbol].push({
          volume: asset.volume,
          purchaseDate: new Date(asset.date),
          cost: asset.cost
        });
      }
      for (const symbol in map) {
        map[symbol].sort((a, b) => a.purchaseDate - b.purchaseDate);
      }
      return map;
    }

    function getVolumeAtTime(lots, t) {
      return lots
        .filter(lot => lot.purchaseDate <= t)
        .reduce((sum, lot) => sum + lot.volume, 0);
    }

    function buildPriceMap(chartData) {
      const sorted = [...chartData].sort((a, b) => new Date(a.date) - new Date(b.date));
      return sorted;
    }

    function getPriceAtTime(sortedData, t) {
      let lastPrice = null;
      for (const point of sortedData) {
        if (new Date(point.date) <= t) lastPrice = point.close;
        else break;
      }
      return lastPrice;
    }

    // ---- MAIN ----
    const allAssets = [
      ...stockArray,
      ...etfArray,
      ...cryptoArray,
      ...goldArray
    ];

    const allMergeAssets = [
      ...mergeStock,
      ...mergeEtf,
      ...mergeCrypto,
      ...mergeGold
    ];

    console.log(allMergeAssets);

    const assetGroups = groupAssetsBySymbol(allAssets);

    function normalizeSymbol(symbol) {
      if (symbol === 'GC=F') {
        return "GOLD"
      }
      return symbol.replace('-USD', '');
    }

    const symbolChartMap = {};
    for (const item of chartAllSymbol) {
      const normalizedKey = normalizeSymbol(item.symbol); // "BTC-USD" → "BTC"
      symbolChartMap[normalizedKey] = buildPriceMap(item.data);
    }

    chartData = chartData.map(point => {
      const t = new Date(point.date);
      
      let totalValue = moneyUser;

      for (const symbol in assetGroups) {
        const lots = assetGroups[symbol];
        const volume = getVolumeAtTime(lots, t);
        const price = getPriceAtTime(symbolChartMap[symbol] ?? [], t);

        console.log(symbol, volume, price)

        if (volume > 0 && price !== null) {
          totalValue += (volume * price);
        }

        if (price === null) {
          const selectAsset = allMergeAssets.find(asset => asset.symbol === symbol);
          const volumeAsset = selectAsset.volume;
          totalValue += priceMap[symbol].price * volumeAsset;

          // console.log(symbol, priceMap[symbol].price, volumeAsset);
        } else if (volume <= 0 && price === null) {
          const selectAsset = allMergeAssets.find(asset => asset.symbol === symbol);
          const cost = selectAsset.cost;
          totalValue += cost;
        }
      }

      return {
        date: point.date,
        close: totalValue
      };
    });
  }

  chartData = chartData.filter(item => {
    const itemDate = new Date(item.date);
    
    return itemDate.getTime() <= today.getTime() + 1000;
  });

  chartData = chartData.filter(item => {
    const itemDate = new Date(item.date);
    const createDate = userData.time;

    return createDate.getTime() <= itemDate.getTime();
  });

  console.table(chartData);

  const priceData = chartData.map(item => item.close);

  let minValue = Math.min(...priceData);
  let maxValue = Math.max(...priceData);
  let axisY = [];
  let axisYRaw = [];

  if (minValue === maxValue) {
    chartData = chartData.map(item => ({
      ...item,
      close: item.close * (1 + ((Math.random() * 2) - 1)/20000)
    }));
  }

  minValue *= 0.95;
  maxValue *= 1.05;

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
  let axisX = [];
  let chartArray = []; // 'x,y' '50-1460, 0-300'
  let chartArrayX = []; // 'x'
  let chartArrayY = []; // 'y'

  const mapRange = (value, inMin, inMax, outMin, outMax, clamp = false) => {
    const mapped = ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
    if (!clamp) return mapped;
    return Math.min(Math.max(mapped, outMin), outMax);
  };

  axisX = buildAxisX(chartData);
  // console.log(axisX);
  
  const axisStart = new Date(axisX[0].date);
  const axisEnd = new Date(axisX[axisX.length - 1].date);
  const totalTimeM = (axisEnd - axisStart) / (1000 * 60);

  function createLine(chartData, array, arrayX, arrayY) {
    for (let i = 0; i < chartData.length; i++) {
      const dataTime = new Date(chartData[i].date);

      if (dataTime < axisStart || dataTime > axisEnd) continue;
      const dataValue = chartData[i].close;

      const diffTimeM = (dataTime - axisStart) / (1000 * 60);

      const timeX = mapRange(diffTimeM, 0, totalTimeM, 50, 1460, false);
      const valueY =  300 - mapRange(dataValue, axisYRaw[0], axisYRaw[6], 0, 300, true);

      array.push(`${timeX.toFixed(2)},${valueY.toFixed(2)}`);
      arrayX.push(`${timeX.toFixed(2)}`);
      arrayY.push(`${valueY.toFixed(2)}`);
    }
  }
  
  createLine(chartData, chartArray, chartArrayX, chartArrayY);

  // ! init label
  const chartX = doc.querySelectorAll('.chart-label-x');
  for (let i = 0; i < axisX.length; i++) {
    chartX[i].innerHTML = axisX[i].label;
  }
  const chartXdate = doc.querySelector('.chart-label-x-date');
  const crossDate = dayjs(axisEnd).tz('Asia/Bangkok').format('DD MMM');
  chartXdate.innerHTML = crossDate;


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
  await new Promise(resolve => setTimeout(resolve, 1000));

  const screenshot = await page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: 1920, height: 1080 },
  });

  await browser.close();
  server.close();
  
  // console.log('done');
  // fs.writeFileSync("output.png", screenshot); // เพิ่มบรรทัดนี้

  return screenshot;
}

// capturePortfolio();

module.exports = { capturePortfolio };