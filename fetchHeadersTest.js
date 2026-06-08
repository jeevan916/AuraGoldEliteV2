import http from 'http';
http.get('http://127.0.0.1:3000/api/logs/errors', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data.substring(0, 50)));
});
