// yahoo-news.js
const Parser = require('rss-parser');
const parser = new Parser();


async function getNews() {
  const url = 'https://finance.yahoo.com/rss/topstories';
  const feed = await parser.parseURL(url);

  console.log(feed);
}

getNews();