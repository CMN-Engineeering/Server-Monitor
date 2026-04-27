const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const https = require('https'); // Import https module

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, 'sys-data.json');

// Read SSL Certificates
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

app.use(cors()); 
app.use(express.json()); 
app.use(express.static(__dirname));

app.get('/api/load-data', (req, res) => {
    // Reads the latest data from the local broker/file whenever requested
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) return res.json({ factories: [] }); 
        try { res.json(JSON.parse(data)); } 
        catch (parseError) { res.status(500).json({ error: "Invalid JSON format" }); }
    });
});

app.post('/api/save-data', (req, res) => {
    const newData = req.body;
    fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 4), 'utf8', (err) => {
        if (err) {
            console.error("Lỗi khi ghi file:", err);
            return res.status(500).json({ success: false, message: 'Lưu dữ liệu thất bại' });
        }
        console.log("✅ Dữ liệu đã được lưu thành công vào sys-data.json");
        res.json({ success: true, message: 'Đã lưu dữ liệu' });
    });
});

// Start HTTPS Server
https.createServer(sslOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Backend server (HTTPS) đang chạy tại: https://localhost:${PORT}`);
});