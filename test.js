const https = require('https');

const req = https.get('https://uat.batuk.in/augmont/gold', {
    headers: {
        'User-Agent': 'Mozilla/5.0'
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        console.log("Data:", data);
    });
});
req.on('error', console.error);
