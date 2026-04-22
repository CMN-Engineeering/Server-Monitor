const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Path to your JSON file
const DATA_FILE = path.join(__dirname, 'sys-data.json');

// Middleware
app.use(cors()); // Cho phép frontend gọi API
app.use(express.json()); // Cho phép server đọc JSON body

// ==========================================
// API: LOAD DATA
// ==========================================
app.get('/api/load-data', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error("Lỗi khi đọc file:", err);
            // Trả về cấu trúc trống nếu file không tồn tại
            return res.json({ factories: [] }); 
        }
        try {
            res.json(JSON.parse(data));
        } catch (parseError) {
            console.error("Lỗi parse JSON:", parseError);
            res.status(500).json({ error: "Invalid JSON format in sys-data.json" });
        }
    });
});

// ==========================================
// API: SAVE DATA
// ==========================================
app.post('/api/save-data', (req, res) => {
    const newData = req.body;
    
    // Ghi đè dữ liệu mới vào sys-data.json (format với 4 spaces cho đẹp)
    fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 4), 'utf8', (err) => {
        if (err) {
            console.error("Lỗi khi ghi file:", err);
            return res.status(500).json({ success: false, message: 'Lưu dữ liệu thất bại' });
        }
        console.log("✅ Dữ liệu đã được lưu thành công vào sys-data.json");
        res.json({ success: true, message: 'Đã lưu dữ liệu' });
    });
});

// Khởi động Server
app.listen(PORT, () => {
    console.log(`✅ Backend server đang chạy tại: http://localhost:${PORT}`);
    console.log(`📡 Mở trang HTML của bạn để bắt đầu tương tác.`);
});