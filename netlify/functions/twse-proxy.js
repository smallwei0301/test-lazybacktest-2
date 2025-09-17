// netlify/functions/twse-proxy.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    const { stockNo, date } = event.queryStringParameters; // date format: 20240801
    if (!stockNo || !date) return { statusCode: 400, body: JSON.stringify({ error: '缺少股票代號或日期' }) };

    const targetUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${stockNo}`;
    
    try {
        const response = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await response.json();

        if (data.stat !== 'OK') {
           return { statusCode: 200, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ aaData: [] }) };
        }
        
        const stockName = data.title.split(' ')[2];
        const formattedAaData = data.data.map(item => [ item[0], stockNo, stockName, parseFloat(item[3].replace(/,/g, '')), parseFloat(item[4].replace(/,/g, '')), parseFloat(item[5].replace(/,/g, '')), parseFloat(item[6].replace(/,/g, '')), parseFloat(item[8].replace(/,/g, '')), parseInt(item[1].replace(/,/g, ''), 10) ]);

        return { statusCode: 200, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({
            stockName: stockName,
            iTotalRecords: formattedAaData.length,
            aaData: formattedAaData,
            dataSource: 'TWSE'
        }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};