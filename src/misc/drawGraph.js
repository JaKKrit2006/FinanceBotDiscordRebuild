const { createCanvas, loadImage } = require("canvas");

/**
 * @param {Array<{date,open,high,low,close,volume?,adjclose?}>} ohlcData
 * @param {object} [opts]
 * @param {string}  [opts.symbol="AAPL"]
 * @param {string}  [opts.timeframe="1D"]
 * @param {string}  [opts.url_image]
 * @returns {Promise<Buffer>}
 */
async function drawCandlestickChart(ohlcData, opts = {}) {
  const width  = 1920;
  const height = 1080;

  const {
    symbol    = "AAPL",
    timeframe = "1D",
    url_image = null,
    _volume   = undefined,
    _adjclose = undefined,
  } = opts;

  const LOGO_SIZE    = Math.round(height * 0.085);
  const SYM_FONT     = Math.round(height * 0.055);
  const PRICE_FONT   = Math.round(height * 0.038);
  const CHG_FONT     = Math.round(height * 0.026);
  const DATE_FONT    = Math.round(height * 0.020);
  const HEADER_PAD_T = Math.round(height * 0.030);
  const ROW_GAP      = Math.round(height * 0.003);

  const ROW1_Y = HEADER_PAD_T + SYM_FONT;
  const ROW2_Y = ROW1_Y + PRICE_FONT + ROW_GAP;
  const ROW3_Y = ROW2_Y + DATE_FONT + ROW_GAP;

  const TOP_PAD_TOTAL = ROW3_Y + Math.round(height * 0.030);

  // ── Layout ────────────────────────────────────────────────
  const PAD = { top: TOP_PAD_TOTAL, right: 100, bottom: 70, left: 120 };
  const CW  = width  - PAD.left - PAD.right;
  const CH  = height - PAD.top  - PAD.bottom;
  const n   = ohlcData.length;

  // ── Canvas ────────────────────────────────────────────────
  const canvas = createCanvas(width, height);
  const ctx    = canvas.getContext("2d");

  const C = {
    bg         : "#131722",
    panel      : "#1E222D",
    grid       : "#2A2E39",
    axis       : "#B2B5BE",
    text       : "#EAECF0",
    subtext    : "#787B86",
    bull       : "#26A69A",
    bullEdge   : "#1A7A70",
    bear       : "#EF5350",
    bearEdge   : "#B83B39",
    priceLine  : "#26A69A",
  };

  // ── Price range ───────────────────────────────────────────
  const allPrices = ohlcData.flatMap((d) => [d.high, d.low]);
  const priceMin  = Math.min(...allPrices);
  const priceMax  = Math.max(...allPrices);
  const pricePad  = (priceMax - priceMin) * 0.08;
  const yMin = priceMin - pricePad;
  const yMax = priceMax + pricePad;

  // ── Helpers ───────────────────────────────────────────────
  const toY   = (v) => PAD.top + CH - ((v - yMin) / (yMax - yMin)) * CH;
  const barW  = CW / n;
  const bodyW = Math.max(6, barW * 0.6);
  const toX   = (i) => PAD.left + i * barW + barW / 2;

  // ── Background ──────────────────────────────────────────────
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, width, height);

  // ── Horizon Grid ──────────────────────────
  const gridLines  = 6;
  const labelEvery = Math.max(1, Math.floor(n / 20));

  ctx.font      = `${DATE_FONT}px monospace`;
  ctx.textAlign = "right";

  for (let g = 0; g <= gridLines; g++) {
    const price = yMin + ((yMax - yMin) * g) / gridLines;
    const y     = toY(price);
    
    ctx.strokeStyle = C.grid;
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + CW, y);
    ctx.stroke();

    ctx.fillStyle = C.axis;
    ctx.fillText(price.toFixed(2), PAD.left - 15, y + 6);
  }

  // ── Vertical Grid ──────────────────────────────────────────
  ohlcData.forEach((d, i) => {
    if (i % labelEvery === 0 || i === n - 1) {
      const x = toX(i);
      ctx.strokeStyle = C.grid;
      ctx.lineWidth   = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, PAD.top + CH);
      ctx.stroke();
    }
  });

  // ── Candlestick ───────────────────────────────────────────
  ohlcData.forEach((d, i) => {
    
    let bull;
    if (i > 0) {
      bull = d.close >= ohlcData[i - 1].close; 
    } else {
      bull = d.close >= d.open; 
    }

    const x      = toX(i);
    const yHigh  = toY(d.high);
    const yLow   = toY(d.low);
    const yOpen  = toY(d.open);
    const yClose = toY(d.close);

    ctx.beginPath();
    ctx.strokeStyle = bull ? C.bull : C.bear;
    ctx.lineWidth   = 1.5;
    ctx.lineCap     = "round";
    ctx.moveTo(x, yHigh);
    ctx.lineTo(x, yLow);
    ctx.stroke();

    const bodyTop = Math.min(yOpen, yClose);
    const bodyH   = Math.max(Math.abs(yClose - yOpen), 2);
    ctx.fillStyle   = bull ? C.bull  : C.bear;
    ctx.strokeStyle = bull ? C.bullEdge : C.bearEdge;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 3);
    ctx.fill();
    ctx.stroke();
  });

  // ── Current Price Dashed Line ─────────────────────────────
  const last     = ohlcData[n - 1];
  const currentY = toY(last.close);

  ctx.save();
  ctx.strokeStyle = C.priceLine;
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(PAD.left, currentY);
  ctx.lineTo(PAD.left + CW, currentY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── Price Label (ขวา) ─────────────────────────────────────
  const plabelH   = Math.round(height * 0.024);
  const plabelPad = 10;
  const plabelW   = PAD.right - 8;
  const plx       = PAD.left + CW + 4;

  ctx.fillStyle = C.priceLine;
  roundRect(ctx, plx, currentY - plabelH / 2 - plabelPad / 2, plabelW, plabelH + plabelPad, 4);
  ctx.fill();
  ctx.font      = `bold ${plabelH}px monospace`;
  ctx.fillStyle = "#131722";
  ctx.textAlign = "center";
  ctx.fillText(last.close.toFixed(2), plx + plabelW / 2, currentY + plabelH / 2 - 2);

  // ── X-axis Labels ─────────────────────────────────────────
  ctx.font      = `${DATE_FONT}px monospace`;
  ctx.fillStyle = C.axis;
  ctx.textAlign = "center";
  ohlcData.forEach((d, i) => {
    if (i % labelEvery === 0 || i === n - 1) {
      ctx.fillText(formatDate(d.date), toX(i), PAD.top + CH + 32);
    }
  });

  ctx.strokeStyle = C.grid;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top + CH);
  ctx.lineTo(PAD.left + CW, PAD.top + CH);
  ctx.stroke();

  // ─────────────────────────────────────────────────────────
  // ── HEADER ───────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────

  const LOGO_X  = PAD.left;
  let   textX   = PAD.left;

  const TEXT_BLOCK_TOP = ROW1_Y - SYM_FONT;
  const TEXT_BLOCK_H   = ROW3_Y - TEXT_BLOCK_TOP;
  const TEXT_CENTER_Y  = TEXT_BLOCK_TOP + (TEXT_BLOCK_H / 2);
  const LOGO_Y         = TEXT_CENTER_Y - (LOGO_SIZE / 2);

  if (url_image) {
    try {
      const img = await loadImage(url_image);
      ctx.save();
      ctx.beginPath();

      roundRect(ctx, LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE, 16);
      ctx.clip();

      const imgRatio = img.width / img.height;
      let sx, sy, sWidth, sHeight;
      if (imgRatio > 1) {

          sHeight = img.height;
          sWidth  = img.height;
          sx      = (img.width - sWidth) / 2;
          sy      = 0;
      } else {

          sWidth  = img.width;
          sHeight = img.width;
          sx      = 0;
          sy      = (img.height - sHeight) / 2;
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
      ctx.restore();
      textX = LOGO_X + LOGO_SIZE + Math.round(width * 0.012);
    } catch (e) {
      console.warn("⚠️  โหลด url_image ไม่ได้:", e.message);
    }
  }

  ctx.font      = `bold ${SYM_FONT}px Georgia, serif`;
  ctx.fillStyle = C.text;
  ctx.textAlign = "left";
  ctx.fillText(symbol, textX, ROW1_Y);

  const symW     = ctx.measureText(symbol).width;
  const TF_FONT  = Math.round(height * 0.022);
  ctx.font       = `${TF_FONT}px monospace`;
  const tfW      = ctx.measureText(timeframe).width + 24;
  const tfH      = TF_FONT + 12;
  const tfBadgeX = textX + symW + 20;
  const tfBadgeY = ROW1_Y - TF_FONT - 6;

  ctx.fillStyle = C.panel;
  roundRect(ctx, tfBadgeX, tfBadgeY, tfW, tfH, 6);
  ctx.fill();
  ctx.fillStyle = C.axis;
  ctx.fillText(timeframe, tfBadgeX + 12, tfBadgeY + TF_FONT + 2);

  const prev   = ohlcData[n - 2];
  const chg    = last.close - prev.close;
  const pct    = (chg / prev.close) * 100;
  const sign   = chg >= 0 ? "+" : "";
  const cColor = chg >= 0 ? C.bull : C.bear;

  ctx.font      = `bold ${PRICE_FONT}px monospace`;
  ctx.fillStyle = C.text;
  ctx.textAlign = "left";
  ctx.fillText(last.close.toFixed(2), textX, ROW2_Y);

  const priceW = ctx.measureText(last.close.toFixed(2)).width;

  ctx.font      = `${CHG_FONT}px monospace`;
  ctx.fillStyle = cColor;
  const chgOffY = (PRICE_FONT - CHG_FONT) * 0.4;
  ctx.fillText(
    `${sign}${chg.toFixed(2)} (${sign}${pct.toFixed(2)}%)`,
    textX + priceW + 20,
    ROW2_Y - chgOffY
  );

  const first = ohlcData[0];
  ctx.font      = `${DATE_FONT}px monospace`;
  ctx.fillStyle = C.subtext;
  ctx.fillText(
    `${formatDate(first.date)} – ${formatDate(last.date)}`,
    textX, ROW3_Y
  );

  const legendRX = PAD.left + CW;
  const legendY  = ROW1_Y - 5; 

  drawLegendItem(ctx, legendRX - 70,  legendY, C.bear, "Bearish");
  drawLegendItem(ctx, legendRX - 190, legendY, C.bull, "Bullish");

  return canvas.toBuffer("image/png");
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function formatDate(dateVal) {
  const d  = new Date(dateVal);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

function drawLegendItem(ctx, x, y, color, label) {
  const BOX = 14; 
  ctx.fillStyle = color;
  ctx.fillRect(x - BOX - 8, y - BOX + 2, BOX, BOX);
  ctx.font      = "16px monospace"; 
  ctx.fillStyle = "#B2B5BE";
  ctx.textAlign = "left";
  ctx.fillText(label, x, y);
}


module.exports = { drawCandlestickChart };