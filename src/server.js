const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, 'sys-data.json');

app.use(cors()); 
app.use(express.json()); 

// THÊM DÒNG NÀY: Cho phép Node.js phục vụ các file frontend (index.html, styles.css, script.js)
app.use(express.static(__dirname));

app.get('/api/load-data', (req, res) => {
    // ... (Giữ nguyên code cũ) ...
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) return res.json({ factories: [] }); 
        try { res.json(JSON.parse(data)); } 
        catch (parseError) { res.status(500).json({ error: "Invalid JSON format" }); }
    });
});

app.post('/api/save-data', (req, res) => {
    const newData = req.body;
    
    // Ghi đè dữ liệu mới vào sys-data.json
    fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 4), 'utf8', (err) => {
        if (err) {
            console.error("Lỗi khi ghi file:", err);
            return res.status(500).json({ success: false, message: 'Lưu dữ liệu thất bại' });
        }
        console.log("✅ Dữ liệu đã được lưu thành công vào sys-data.json");
        res.json({ success: true, message: 'Đã lưu dữ liệu' });
    });
});

app.listen(PORT,'0.0.0.0' ,() => {
    console.log(`✅ Backend server đang chạy tại: http://0.0.0.0:${PORT}`);
});