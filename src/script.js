// ==========================================
// 1. KHỞI TẠO BIẾN VÀ CẤU TRÚC DỮ LIỆU
// ==========================================
let systemData = null;
let currentUser = null; 

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
// 2. XỬ LÝ AUTHENTICATION
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
        window.location.reload();
    }
}

// ==========================================
// 3. TẢI VÀ LƯU DỮ LIỆU
// ==========================================
async function loadSystemData() {
    try {
        const response = await fetch('/api/load-data?_t=' + new Date().getTime());
        if (!response.ok) throw new Error('Failed to load data');
        systemData = await response.json();
        populateFactories();
    } catch (error) {
        console.error('Lỗi server:', error);
    }
}

function saveSystemData() {
    fetch('/api/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemData)
    }).catch(err => console.error('Lỗi khi lưu dữ liệu:', err));
}

// ==========================================
// 4. ĐIỀU HƯỚNG DROPDOWN
// ==========================================
function populateFactories() {
    factorySelect.innerHTML = '<option value="">-- Chọn nhà máy --</option>';
    if (systemData && systemData.factories) {
        systemData.factories.forEach((factory, index) => {
            factorySelect.add(new Option(factory.name || factory.id, index));
        });
        if (selectedFactoryIndex !== null) factorySelect.value = selectedFactoryIndex;
    }
}

function loadStorages() {
    storageSelect.innerHTML = '<option value="">-- Chọn kho --</option>';
    machineSelect.innerHTML = '<option value="">-- Chọn máy --</option>';
    selectedFactoryIndex = factorySelect.value;
    
    if (selectedFactoryIndex !== "") {
        const factory = systemData.factories[selectedFactoryIndex];
        factory.storageUnits.forEach((storage, index) => {
            storageSelect.add(new Option(storage.name, index));
        });
    }
    viewStorageDashboard();
}

function loadMachines() {
    machineSelect.innerHTML = '<option value="">-- Chọn máy --</option>';
    selectedStorageIndex = storageSelect.value;

    if (selectedStorageIndex !== "") {
        const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
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

// ==========================================
// 5. DASHBOARD FULL RENDER
// ==========================================
function viewStorageDashboard() {
    if (selectedFactoryIndex === "" || selectedStorageIndex === "") {
        detailsContent.innerHTML = "";
        detailsTitle.innerHTML = "Chọn Nhà máy và Kho để xem Dashboard";
        return;
    }
    
    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    let machinesToRender = [];
    
    if (selectedMachineIndex !== "" && selectedMachineIndex !== null) {
        machinesToRender.push({ machine: storage.machineUnits[selectedMachineIndex], originalIdx: parseInt(selectedMachineIndex) });
    } else {
        machinesToRender = storage.machineUnits.map((m, i) => ({ machine: m, originalIdx: i }));
    }
    
    detailsTitle.innerHTML = `Dashboard: ${storage.name} <span id="dashboard-time" style="font-size:0.6em; color:gray; float:right;">Cập nhật lúc: ${new Date().toLocaleTimeString()}</span>`;
    
    let html = `<div class="machine-grid">`;
    machinesToRender.forEach((item) => {
        const machine = item.machine;
        const mIdx = item.originalIdx;
        
        html += `
        <div class="machine-block" style="border: 1px solid #ccc; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-top:0; border-bottom: 1px solid #eee; padding-bottom:10px;">${machine.name}</h3>
            
            <h4 style="margin: 10px 0;">Inputs</h4>
            <div class="component-mini-grid" style="display:flex; gap: 15px; flex-wrap: wrap; margin-bottom: 20px;">`;
        
        if (machine.inputs) {
            Object.entries(machine.inputs).forEach(([cKey, conv]) => {
                const isRunning = parseInt(conv.status) === 1;
                html += `
                <div id="input-container-${mIdx}-${cKey}" class="conv-item" style="flex:1; min-width: 150px; border: 1px solid #ddd; padding: 12px; border-radius: 6px; background: ${isRunning ? '#d4edda' : '#f8d7da'}; transition: background 0.3s;">
                    <strong style="display:block; margin-bottom:5px;">${conv.name || cKey}</strong>
                    <p id="input-status-${mIdx}-${cKey}" style="margin:5px 0;">Trạng thái: ${isRunning ? '🟢 Đang chạy' : '🔴 Dừng'}</p>
                    <p style="margin:5px 0;">Tốc độ: <span id="input-rpm-${mIdx}-${cKey}" style="font-weight:bold;">${conv.rpm || 0}</span> RPM</p>
                    <button id="input-btn-${mIdx}-${cKey}" style="width:100%; background:${isRunning ? '#dc3545' : '#28a745'}; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold;" onclick="togglecomponent(${mIdx}, '${cKey}')">
                        ${isRunning ? 'Tắt' : 'Bật'}
                    </button>
                </div>`;
            });
        }
        
        html += `</div>
            
            <h4 style="margin: 10px 0;">Động cơ (Motors)</h4>`;
        
        if (machine.motors) {
            // Kiểm tra trạng thái enabled (xử lý cả boolean và số)
            const isMotorsEnabled = machine.motors.enabled === true || parseInt(machine.motors.enabled) === 1;
            
            // Nút điều khiển tổng (Disable/Enable)
            html += `
            <div style="margin-bottom: 15px;">
                <button id="motor-enable-btn-${mIdx}" style="background:${isMotorsEnabled ? '#6c757d' : '#007bff'}; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;" onclick="toggleMotorEnable(${mIdx})">
                    ${isMotorsEnabled ? 'Vô hiệu hóa toàn bộ Motors (Disable)' : 'Kích hoạt Motors (Enable)'}
                </button>
            </div>
            
            <div id="motor-list-container-${mIdx}" class="component-mini-grid" style="display:${isMotorsEnabled ? 'flex' : 'none'}; gap: 15px; flex-wrap: wrap;">`;

            // Render các motor con bên trong
            const motorKeys = Object.keys(machine.motors).filter(k => k.startsWith('motor_'));
            motorKeys.forEach(moKey => {
                const motor = machine.motors[moKey];
                const isOn = parseInt(motor.state) === 1;
                
                html += `
                <div id="motor-container-${mIdx}-${moKey}" class="motor-item" style="flex:1; min-width: 150px; border: 1px solid #ddd; padding: 12px; border-radius: 6px; background: ${isOn ? '#d4edda' : '#f8d7da'}; transition: background 0.3s;">
                    <strong style="display:block; margin-bottom:5px;">${motor.name || moKey.replace('_', ' ').toUpperCase()}</strong>
                    <p id="motor-status-${mIdx}-${moKey}" style="margin:5px 0;">Trạng thái: ${isOn ? '🟢 Đang chạy' : '🔴 Dừng'}</p>
                    <button id="motor-btn-${mIdx}-${moKey}" style="width:100%; background:${isOn ? '#dc3545' : '#28a745'}; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold;" onclick="toggleMotorState(${mIdx}, '${moKey}')">
                        ${isOn ? 'Tắt' : 'Bật'}
                    </button>
                </div>`;
            });
            
            html += `</div>`; // Đóng motor-list-container
        }

        html += `</div>`; // Đóng machine-block
    });
    html += `</div>`;
    detailsContent.innerHTML = html;
}

// ==========================================
// 6. SOFT UPDATE (UI SYNC)
// ==========================================
function updateDashboardData() {
    if (!systemData || selectedStorageIndex === "") return;
    
    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    storage.machineUnits.forEach((machine, mIdx) => {
        // Sync Inputs
        if (machine.inputs) {
            Object.entries(machine.inputs).forEach(([cKey, conv]) => {
                const isRunning = parseInt(conv.status) === 1;
                const container = document.getElementById(`input-container-${mIdx}-${cKey}`);
                const statusEl = document.getElementById(`input-status-${mIdx}-${cKey}`);
                const rpmEl = document.getElementById(`input-rpm-${mIdx}-${cKey}`);
                const btnEl = document.getElementById(`input-btn-${mIdx}-${cKey}`);

                if (container && statusEl && rpmEl && btnEl) {
                    container.style.background = isRunning ? '#d4edda' : '#f8d7da';
                    statusEl.innerText = `Trạng thái: ${isRunning ? '🟢 Đang chạy' : '🔴 Dừng'}`;
                    rpmEl.innerText = conv.rpm || 0;
                    btnEl.style.background = isRunning ? '#dc3545' : '#28a745';
                    btnEl.innerText = isRunning ? 'Tắt' : 'Bật';
                }
            });
        }

        // Sync Motors
        if (machine.motors) {
            const isMotorsEnabled = machine.motors.enabled === true || parseInt(machine.motors.enabled) === 1;
            
            // Cập nhật nút Disable/Enable và ẩn/hiện container
            const enableBtnEl = document.getElementById(`motor-enable-btn-${mIdx}`);
            const motorListContainer = document.getElementById(`motor-list-container-${mIdx}`);
            
            if (enableBtnEl && motorListContainer) {
                enableBtnEl.style.background = isMotorsEnabled ? '#6c757d' : '#007bff';
                enableBtnEl.innerText = isMotorsEnabled ? 'Vô hiệu hóa toàn bộ Motors (Disable)' : 'Kích hoạt Motors (Enable)';
                motorListContainer.style.display = isMotorsEnabled ? 'flex' : 'none';
            }

            // Đồng bộ trạng thái từng motor con
            const motorKeys = Object.keys(machine.motors).filter(k => k.startsWith('motor_'));
            motorKeys.forEach(moKey => {
                const motor = machine.motors[moKey];
                const isOn = parseInt(motor.state) === 1;
                const container = document.getElementById(`motor-container-${mIdx}-${moKey}`);
                const statusEl = document.getElementById(`motor-status-${mIdx}-${moKey}`);
                const btnEl = document.getElementById(`motor-btn-${mIdx}-${moKey}`);

                if (container && statusEl && btnEl) {
                    container.style.background = isOn ? '#d4edda' : '#f8d7da';
                    statusEl.innerText = `Trạng thái: ${isOn ? '🟢 Đang chạy' : '🔴 Dừng'}`;
                    btnEl.style.background = isOn ? '#dc3545' : '#28a745';
                    btnEl.innerText = isOn ? 'Tắt' : 'Bật';
                }
            });
        }
    });
}

// ==========================================
// 7. CÁC HÀM TƯƠNG TÁC (COMMANDS)
// ==========================================
window.togglecomponent = function(machineIdx, convKey) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    const component = machine.inputs[convKey];
    component.status = parseInt(component.status) === 1 ? 0 : 1;
    saveSystemData();
}

window.toggleMotorState = function(machineIdx, motorKey) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    const motor = machine.motors[motorKey];
    motor.state = parseInt(motor.state) === 1 ? 0 : 1;
    saveSystemData();
}

window.toggleMotorEnable = function(machineIdx) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    
    if (machine.motors) {
        // Lấy trạng thái hiện tại và đảo ngược
        const currentState = machine.motors.enabled;
        let newState;
        
        // Xử lý linh hoạt cho cả boolean và number (1/0)
        if (typeof currentState === 'boolean') {
            newState = !currentState;
        } else {
            newState = parseInt(currentState) === 1 ? 0 : 1;
        }
        
        machine.motors.enabled = newState;
        saveSystemData();
        viewStorageDashboard(); // Gọi lại render ngay lập tức để cập nhật UI mượt mà
    }
}

// ==========================================
// 8. KHỞI ĐỘNG VÀ SOCKET
// ==========================================
const socket = io();
socket.on('system-data-updated', (updatedData) => {
    systemData = updatedData;
    updateDashboardData();
});

document.addEventListener('DOMContentLoaded', () => {
    const savedSession = localStorage.getItem('monitorSession');
    if (savedSession) {
        currentUser = JSON.parse(savedSession);
        startApp();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }
});