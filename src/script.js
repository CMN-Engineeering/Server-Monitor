// ==========================================
// 1. KHỞI TẠO BIẾN VÀ CẤU TRÚC DỮ LIỆU
// ==========================================
let systemData = null;
let currentUser = null; // { role: 'admin' | 'operator' }

let selectedFactoryIndex = null;
let selectedStorageIndex = null;
let selectedMachineIndex = null;

const factorySelect = document.getElementById('factory-select');
const storageSelect = document.getElementById('storage-select');
const machineSelect = document.getElementById('machine-select');
const detailsPanel = document.getElementById('details-panel');
const detailsTitle = document.getElementById('details-title');
const detailsContent = document.getElementById('details-content');

// ==========================================
// 2. XỬ LÝ AUTHENTICATION (LOGIN/LOGOUT LƯU PHIÊN)
// ==========================================
function login() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    
    if (u === 'admin' && p === 'admin') {
        currentUser = { role: 'admin', name: 'Administrator' };
    } else if (u === 'operator' && p === 'operator') {
        currentUser = { role: 'operator', name: 'Operator' };
    } else {
        document.getElementById('login-error').style.display = 'block';
        return;
    }

    loadSystemData();
    localStorage.setItem('monitorSession', JSON.stringify(currentUser));
    window.location.reload();
}

function startApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    document.getElementById('user-display').innerText = `👤 ${currentUser.name} (${currentUser.role})`;
    
    document.body.className = `role-${currentUser.role}`;
    loadSystemData();
}

function logout() {
    if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
        currentUser = null;
        localStorage.removeItem('monitorSession'); 
        
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('login-error').style.display = 'none';
        clearAllSelections();
    }
    window.location.reload();
}

// ==========================================
// 3. TẢI VÀ LƯU DỮ LIỆU
// ==========================================
async function loadSystemData() {
    try {
        const response = await fetch('/api/load-data');
        if (!response.ok) throw new Error('Failed to load data');
        systemData = await response.json();
        populateFactories();
    } catch (error) {
        console.error('Lỗi server, thử đọc file local:', error);
        try {
            const response = await fetch('sys-data.json');
            systemData = await response.json();
            populateFactories();
        } catch (fileError) {
            alert('Lỗi: Không thể tải dữ liệu. Bật server.js lên nhé!');
        }
    }
}

function saveSystemData() {
    // Lưu ngầm không reload trang
    fetch('/api/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemData)
    }).catch(err => console.error('Lỗi khi lưu dữ liệu:', err));
}

// ==========================================
// 4. QUẢN LÝ FACTORY VÀ STORAGE
// ==========================================
function populateFactories() {
    factorySelect.innerHTML = '<option value="">-- Chọn nhà máy --</option>';
    if (systemData && systemData.factories) {
        systemData.factories.forEach((factory, index) => {
            factorySelect.add(new Option(factory.id, index));
        });
    }
}

function addFactory() {
    const factoryName = prompt("Nhập tên nhà máy mới:");
    if (!factoryName) return;
    systemData.factories.push({ id: factoryName.trim(), storageUnits: [] });
    saveSystemData(); populateFactories();
}

function deleteFactory() {
    if (factorySelect.value === "") return alert("Chọn nhà máy để xóa!");
    if (confirm("Chắc chắn xóa?")) {
        systemData.factories.splice(factorySelect.value, 1);
        saveSystemData(); populateFactories(); clearAllSelections();
    }
}

function loadStorages() {
    storageSelect.innerHTML = '<option value="">-- Chọn kho --</option>';
    machineSelect.innerHTML = '<option value="">-- Chọn máy --</option>';
    
    selectedFactoryIndex = factorySelect.value;
    if (selectedFactoryIndex === "") {
        detailsPanel.innerHTML = '<h2>Chọn Nhà máy và Kho để xem Dashboard</h2>';
        return;
    }
    
    const factory = systemData.factories[selectedFactoryIndex];
    if (factory.storageUnits) {
        factory.storageUnits.forEach((storage, index) => {
            storageSelect.add(new Option(storage.name, index));
        });
    }
}

function addStorage() {
    if (!selectedFactoryIndex) return alert("Chọn nhà máy trước!");
    const storageName = prompt("Nhập tên kho:");
    if (!storageName) return;
    
    systemData.factories[selectedFactoryIndex].storageUnits.push({
        id: `storage_${Date.now()}`, name: storageName.trim(), machineUnits: []
    });
    saveSystemData(); loadStorages();
}

function deleteStorage() {
    if (!storageSelect.value) return alert("Chọn kho để xóa!");
    if (confirm("Chắc chắn xóa kho?")) {
        systemData.factories[selectedFactoryIndex].storageUnits.splice(storageSelect.value, 1);
        saveSystemData(); loadStorages();
    }
}

// ==========================================
// 5. QUẢN LÝ MÁY & BĂNG TẢI
// ==========================================
function loadMachines() {
    machineSelect.innerHTML = '<option value="">-- Chọn máy --</option>';
    selectedMachineIndex = ""; // Reset trạng thái chọn máy
    
    selectedStorageIndex = storageSelect.value;
    if (selectedStorageIndex === "") return;

    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    if (storage.machineUnits) {
        storage.machineUnits.forEach((machine, index) => {
            machineSelect.add(new Option(machine.name, index));
        });
    }

    viewStorageDashboard();
}

function handleMachineSelection() {
    selectedMachineIndex = machineSelect.value;
    viewStorageDashboard();
}

function addMachine() {
    if (!selectedStorageIndex) return alert("Chọn kho trước!");
    
    const machineName = prompt("Nhập tên máy:");
    if (!machineName) return;
    
    const machineType = prompt("Nhập loại máy (vd: Bồn Chứa):");
    
    const machineId = prompt("Nhập ID cấu hình máy (vd: MAC-001):");
    if (!machineId) return alert("ID máy không được để trống!");
    
    const machineIp = prompt("Nhập IP máy (vd: 192.168.1.100):");
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(machineIp)){
        return alert("IP không hợp lệ!");
    }
    
    systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits.push({
        id: machineId,
        name: machineName.trim(),
        type: machineType ? machineType.trim() : "Unknown",
        ip: machineIp,
        "components": [
                        {
                            "id": "component1",
                            "name": "component Belt 1",
                            "status": "stopped",
                            "speed": 0
                        },
                        {
                            "id": "component2",
                            "name": "component Belt 2",
                            "status": "stopped",
                            "speed": 0
                        }
                    ] 
    });
    saveSystemData(); 
    loadMachines();
}

function deleteMachine() {
    if (!machineSelect.value) return alert("Chọn máy để xóa!");
    systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits.splice(machineSelect.value, 1);
    saveSystemData(); loadMachines();
}

// ==========================================
// 6. DASHBOARD KHO & MÁY
// ==========================================
function viewStorageDashboard() {
    if (selectedStorageIndex === null || selectedStorageIndex === "") return;
    
    const factory = systemData.factories[selectedFactoryIndex];
    const storage = factory.storageUnits[selectedStorageIndex];
    
    let machinesToRender = [];
    
    // Nếu có chọn một máy cụ thể -> Đi thẳng tới dashboard máy đó
    if (selectedMachineIndex !== null && selectedMachineIndex !== "") {
        machinesToRender.push({ 
            machine: storage.machineUnits[selectedMachineIndex], 
            originalIdx: parseInt(selectedMachineIndex) 
        });
        detailsTitle.innerText = `Dashboard Máy: ${storage.machineUnits[selectedMachineIndex].name}`;
    } else {
        // Không chọn máy cụ thể -> Hiển thị toàn bộ kho
        if (storage.machineUnits) {
            machinesToRender = storage.machineUnits.map((m, i) => ({ machine: m, originalIdx: i }));
        }
        detailsTitle.innerText = `Dashboard Kho: ${storage.name}`;
    }
    
    let html = `<div class="machine-grid">`;
    
    if (machinesToRender.length > 0) {
        machinesToRender.forEach((item) => {
            const machine = item.machine;
            const mIdx = item.originalIdx;
            
            html += `
            <div class="machine-block">
                <div class="machine-header">
                    <div>
                        <h3>${machine.name} (ID: ${machine.id})</h3>
                        <span>Loại: ${machine.type || 'N/A'}</span><br>
                        <small>IP: ${machine.ip || 'Chưa thiết lập'}</small>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        ${currentUser.role === 'admin' ? `<button class="mgmt-btn" onclick="addComponentsToMachine(${mIdx})">Thêm Thiết bị</button>` : ''}
                        ${currentUser.role === 'admin' ? `<button class="mgmt-btn" onclick="editMachineInfo(${mIdx})">⚙️ Sửa IP/ID</button>` : ''}
                    </div>
                </div>
                <div class="component-mini-grid">
            `;
            
            if (machine.components && machine.components.length > 0) {
                machine.components.forEach((conv, cIdx) => {
                    const statusIcon = conv.status === 'running' ? '🟢 Đang chạy' : '🔴 Dừng';
                    html += `
                    <div class="conv-item ${conv.status}">
                        <strong>${conv.name}</strong>
                        <span>Trạng thái: ${statusIcon}</span>
                        <span>Tốc độ: ${conv.speed} RPM</span>
                        <span>Hướng: ${conv.direction || 'Forward'}</span>
                        <div class="conv-controls">
                            <button class="btn-toggle" onclick="togglecomponent(${mIdx}, ${cIdx})">Bật/Tắt</button>
                            ${currentUser.role === 'admin' ? `<button class="btn-config" onclick="editcomponentConfig(${mIdx}, ${cIdx})">Sửa</button>` : ''}
                            
                        </div>
                    </div>`;
                });
            } else {
                html += `<p style="color:#888; font-style:italic;">Máy này chưa có băng tải.</p>`;
            }
            html += `</div></div>`;
        });
    } else {
        html += '<p>Chưa có máy nào để hiển thị.</p>';
    }
    
    html += `</div>`;
    detailsContent.innerHTML = html;
}

// ==========================================
// 7. CÁC HÀM TƯƠNG TÁC (NO REFRESH)
// ==========================================
// Operator & Admin có thể Bật/Tắt
window.togglecomponent = function(machineIdx, convIdx) {
    const component = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx].components[convIdx];
    // Thay đổi trạng thái
    component.status = component.status === 'running' ? 'stopped' : 'running';
    saveSystemData();
    viewStorageDashboard();
}

// Admin: Quản lý băng tải (Trực tiếp từ Dashboard Máy)
window.addComponentsToMachine = function(machineIdx) {
    const componentName = prompt("Nhập tên thiết bị:");
    
    const componentID = prompt("Nhập ID thiết bị:");
    
    if (!componentName) return;
    
    systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx].components.push({
        id: componentID,
        name: componentName.trim(),
        status: "stopped",
        speed: 0,
        direction: "Forward"
    });
    saveSystemData();
    viewStorageDashboard();
}

// Admin: Sửa IP
window.editMachineInfo = function(machineIdx) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    const newIp = prompt(`Sửa IP cho máy ${machine.name}:`, machine.ip || "");
    if (newIp == null || !/^(\d{1,3}\.){3}\d{1,3}$/.test(newIp)) {
        return alert("IP không hợp lệ!");
    }
    machine.ip = newIp;
    saveSystemData();
    viewStorageDashboard();
}

// Admin: Sửa cấu hình
window.editcomponentConfig = function(machineIdx, convIdx) {
    const component = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx].components[convIdx];
    
    const newSpeed = prompt(`Sửa Tốc độ (RPM) cho ${component.name}:`, component.speed);
    if (newSpeed !== null) component.speed = parseInt(newSpeed) || 0;

    const newDirection = prompt(`Sửa Hướng (Forward/Reverse) cho ${component.name}:`, component.direction || "Forward");
    if (newDirection !== null && (newDirection == "Forward" || newDirection == "Reverse")) 
        component.direction = newDirection;
    else alert("Hướng không hợp lệ! Chỉ nhận Forward hoặc Reverse.");
    
    saveSystemData();
    viewStorageDashboard();
}

function clearAllSelections() {
    selectedFactoryIndex = selectedStorageIndex = selectedMachineIndex = null;
    factorySelect.innerHTML = '<option value="">-- Chọn nhà máy --</option>';
    storageSelect.innerHTML = '<option value="">-- Chọn kho --</option>';
    machineSelect.innerHTML = '<option value="">-- Chọn máy --</option>';
    detailsPanel.innerHTML = '<h2>Chọn Nhà máy và Kho để xem Dashboard</h2>';
}

// ==========================================
// 8. KHỞI ĐỘNG TRANG 
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const savedSession = localStorage.getItem('monitorSession');
    if (savedSession) {
        currentUser = JSON.parse(savedSession);
        startApp();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
});

// ==========================================
// 9. REAL-TIME SOCKET.IO UPDATES
// ==========================================
const socket = io();

// Listen for MQTT updates forwarded by the server
socket.on('system-data-updated', (updatedData) => {
    // Only update the UI if the user is currently logged in
    if (currentUser) {
        systemData = updatedData;
        
        // Re-render the dashboard to show the new component statuses (e.g., speed changes, running/stopped)
        if (selectedStorageIndex !== null && selectedStorageIndex !== "") {
            viewStorageDashboard();
        }
    }
});