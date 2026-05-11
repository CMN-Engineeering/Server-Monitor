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
        const response = await fetch('/api/load-data?_t=' + new Date().getTime(), {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        if (!response.ok) throw new Error('Failed to load data');
        systemData = await response.json();
        populateFactories();
    } catch (error) {
        console.error('Lỗi server, thử đọc file local:', error);
        try {
            const response = await fetch('sys-data.json?_t=' + new Date().getTime());
            systemData = await response.json();
            populateFactories();
        } catch (fileError) {
            alert('Lỗi: Không thể tải dữ liệu. Bật server.js lên nhé!');
        }
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
// 4. QUẢN LÝ FACTORY VÀ STORAGE
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

function addFactory() { /* Y như cũ */ }
function deleteFactory() { /* Y như cũ */ }

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
        if (selectedStorageIndex !== null) storageSelect.value = selectedStorageIndex;
    }
    viewStorageDashboard();
}

function addStorage() { /* Y như cũ */ }
function deleteStorage() { /* Y như cũ */ }

// ==========================================
// 5. QUẢN LÝ MÁY & BĂNG TẢI
// ==========================================
function loadMachines() {
    machineSelect.innerHTML = '<option value="">-- Chọn máy --</option>';
    selectedMachineIndex = ""; 
    
    selectedStorageIndex = storageSelect.value;
    if (selectedStorageIndex === "") return;

    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    if (storage.machineUnits) {
        storage.machineUnits.forEach((machine, index) => {
            machineSelect.add(new Option(machine.name, index));
        });
        if (selectedMachineIndex !== null) machineSelect.value = selectedMachineIndex;
    }

    viewStorageDashboard();
}

function handleMachineSelection() {
    selectedMachineIndex = machineSelect.value;
    viewStorageDashboard();
}

function addMachine() { /* Y như cũ */ }
function deleteMachine() { /* Y như cũ */ }

// ==========================================
// 6. DASHBOARD KHO & MÁY (FULL RENDER)
// ==========================================
function viewStorageDashboard() {
    if (selectedStorageIndex === null || selectedStorageIndex === "") return;
    
    const factory = systemData.factories[selectedFactoryIndex];
    const storage = factory.storageUnits[selectedStorageIndex];
    let machinesToRender = [];
    
    const timeStamp = new Date().toLocaleTimeString();
    
    if (selectedMachineIndex !== null && selectedMachineIndex !== "") {
        machinesToRender.push({ 
            machine: storage.machineUnits[selectedMachineIndex], 
            originalIdx: parseInt(selectedMachineIndex) 
        });
        detailsTitle.innerHTML = `Dashboard Máy: ${storage.machineUnits[selectedMachineIndex].name} <span id="dashboard-time" style="font-size:0.6em; color:gray; float:right;">Cập nhật lúc: ${timeStamp}</span>`;
    } else {
        if (storage.machineUnits) {
            machinesToRender = storage.machineUnits.map((m, i) => ({ machine: m, originalIdx: i }));
        }
        detailsTitle.innerHTML = `Dashboard Kho: ${storage.name} <span id="dashboard-time" style="font-size:0.6em; color:gray; float:right;">Cập nhật lúc: ${timeStamp}</span>`;
    }
    
    let html = `<div class="machine-grid">`;
    
    if (machinesToRender.length > 0) {
        machinesToRender.forEach((item) => {
            const machine = item.machine;
            const mIdx = item.originalIdx;
            
            html += `
            <div class="machine-block" style="border: 1px solid #ccc; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <div class="machine-header" style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
                    <div>
                        <h3 style="margin:0; color:#333;">${machine.name} <span style="font-size:0.8em; color:#888;">(${machine.id})</span></h3>
                        <span style="font-size: 0.9em; color:#555;">Loại: ${machine.type || 'N/A'} | IP: ${machine.ip || 'Chưa thiết lập'}</span>
                    </div>
                </div>
                <div class="component-mini-grid" style="display:flex; gap: 15px; flex-wrap: wrap;">
            `;
            
            // Render Inputs with Dynamic IDs
            if (machine.inputs && Object.keys(machine.inputs).length > 0) {
                Object.entries(machine.inputs).forEach(([cKey, conv]) => {
                    const statusVal = parseInt(conv.status) || 0;
                    const isRunning = statusVal === 1;
                    const bgStyle = isRunning ? 'background: #d4edda; border-color: #c3e6cb;' : 'background: #f8d7da; border-color: #f5c6cb;';
                    const iconStyle = isRunning ? 'color: #155724; font-weight:bold;' : 'color: #721c24;';
                    
                    html += `
                    <div id="input-container-${mIdx}-${cKey}" class="conv-item" style="display:flex; flex-direction:column; width: calc(50% - 8px); min-width: 150px; border: 1px solid #ddd; padding: 12px; border-radius: 6px; ${bgStyle} transition: all 0.3s ease;">
                        <strong style="margin-bottom:8px;">${conv.name || cKey.toUpperCase()}</strong>
                        <span id="input-status-${mIdx}-${cKey}" style="${iconStyle}">Trạng thái: ${isRunning ? '🟢 Đang chạy' : '🔴 Dừng'}</span>
                        <span style="margin-bottom:10px;">Tốc độ: <strong id="input-rpm-${mIdx}-${cKey}">${conv.rpm || 0}</strong> RPM</span>
                        <div class="conv-controls" style="margin-top:auto; display:flex; gap:5px;">
                            <button class="btn-toggle" style="flex:1; cursor:pointer; padding:5px; border-radius:4px; border:1px solid #ccc; background:#fff;" onclick="togglecomponent(${mIdx}, '${cKey}')">Đổi TT</button>
                        </div>
                    </div>`;
                });
            } else {
                html += `<p style="color:#888; font-style:italic;">Máy này chưa có dữ liệu input.</p>`;
            }
            html += `</div>`;
            
            // Render Motors with Dynamic IDs
            html += `
            <div class="motors-section" style="margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 15px; width: 100%;">
                <h4 style="margin-top: 0; margin-bottom: 10px;">Điều khiển Động cơ (Motors)</h4>`;
                
            if (machine.motors) {
                const eVal = machine.motors.enabled;
                const isEnabled = eVal === 1 || eVal === "1" || eVal === true || eVal === "true";
                
                html += `
                <div style="margin-bottom: 15px;">
                    <span id="motor-enable-status-${mIdx}" style="padding: 4px 8px; border-radius: 4px; font-size: 0.9em; background: ${isEnabled ? '#d4edda' : '#e2e3e5'}; color: ${isEnabled ? '#155724' : '#383d41'}; border: 1px solid ${isEnabled ? '#c3e6cb' : '#d6d8db'};">
                        ${isEnabled ? '✅ Hệ thống Kích hoạt' : '❌ Hệ thống Vô hiệu hóa'}
                    </span>
                    <button id="motor-enable-btn-${mIdx}" class="mgmt-btn" style="margin-left: 10px; font-size: 0.8em; cursor:pointer;" onclick="toggleMotorEnable(${mIdx})">
                        ${isEnabled ? 'Disable Toàn bộ' : 'Enable Toàn bộ'}
                    </button>
                </div>
                <div style="display:flex; gap: 15px; width: 100%; flex-wrap: wrap;">`;
                
                const motorKeys = Object.keys(machine.motors).filter(k => k.startsWith('motor_'));
                
                if (motorKeys.length > 0) {
                    motorKeys.forEach(moKey => {
                        const motor = machine.motors[moKey];
                        const isOn = parseInt(motor.state) === 1;
                        
                        // Setup fixed HTML structure for toggling view easily without replacing whole DOM
                        html += `
                        <div class="motor-item" style="border: 1px solid #ddd; border-radius: 6px; padding: 12px; flex: 1; min-width: 150px; background: #fff;">
                            <strong style="display: block; margin-bottom: 8px; border-bottom:1px solid #eee; padding-bottom:5px;">${motor.name || moKey.replace('_', ' ').toUpperCase()}</strong>
                            
                            <div id="motor-active-view-${mIdx}-${moKey}" style="display: ${isEnabled ? 'block' : 'none'};">
                                <div id="motor-state-text-${mIdx}-${moKey}" style="margin-bottom: 15px; font-weight: bold; font-size: 1.1em;">
                                    ${isOn ? '<span style="color: #28a745;">🟢 Đang chạy (ON)</span>' : '<span style="color: #dc3545;">🔴 Đã dừng (OFF)</span>'}
                                </div>
                                <div class="motor-controls">
                                    <button id="motor-btn-${mIdx}-${moKey}" class="btn-toggle" style="background: ${isOn ? '#dc3545' : '#28a745'}; color: #fff; border:none; padding: 8px 15px; border-radius: 4px; cursor:pointer; width:100%; font-weight:bold;" onclick="toggleMotorState(${mIdx}, '${moKey}')">
                                        ${isOn ? 'TẮT ĐỘNG CƠ' : 'BẬT ĐỘNG CƠ'}
                                    </button>
                                </div>
                            </div>
                            
                            <div id="motor-disabled-view-${mIdx}-${moKey}" style="display: ${!isEnabled ? 'block' : 'none'};">
                                <div style="color: #721c24; font-size:0.9em; padding:10px 0;">Hệ thống đang bị khóa (Disabled)</div>
                            </div>
                        </div>`;
                    });
                } else {
                    html += `<p style="color:#888;">Không tìm thấy Motor cấu hình.</p>`;
                }
                html += `</div>`;
            } else {
                html += `<p style="color:#888; font-style:italic;">Máy này chưa cấu hình động cơ.</p>`;
            }
            html += `</div></div></div>`;
        });
    } else {
        html += '<p>Chưa có máy nào để hiển thị.</p>';
    }
    
    html += `</div>`;
    detailsContent.innerHTML = html;
}

// ==========================================
// 6.5. SOFT UPDATE DASHBOARD (CHỈ ĐỔI DATA)
// ==========================================
function updateDashboardData() {
    if (selectedStorageIndex === null || selectedStorageIndex === "") return false;
    
    const factory = systemData.factories[selectedFactoryIndex];
    if (!factory) return false;
    const storage = factory.storageUnits[selectedStorageIndex];
    if (!storage) return false;

    let machinesToRender = [];
    if (selectedMachineIndex !== null && selectedMachineIndex !== "") {
        machinesToRender.push({ machine: storage.machineUnits[selectedMachineIndex], originalIdx: parseInt(selectedMachineIndex) });
    } else {
        if (storage.machineUnits) {
            machinesToRender = storage.machineUnits.map((m, i) => ({ machine: m, originalIdx: i }));
        }
    }

    const timeSpan = document.getElementById('dashboard-time');
    if (timeSpan) timeSpan.innerText = `Cập nhật lúc: ${new Date().toLocaleTimeString()}`;

    let requiresFullRender = false;

    machinesToRender.forEach((item) => {
        const machine = item.machine;
        const mIdx = item.originalIdx;

        // Update Inputs Softly
        if (machine.inputs) {
            Object.entries(machine.inputs).forEach(([cKey, conv]) => {
                const statusVal = parseInt(conv.status) || 0;
                const isRunning = statusVal === 1;

                const container = document.getElementById(`input-container-${mIdx}-${cKey}`);
                const statusEl = document.getElementById(`input-status-${mIdx}-${cKey}`);
                const rpmEl = document.getElementById(`input-rpm-${mIdx}-${cKey}`);

                // If DOM structure differs from Data, trigger a full re-render
                if (!container || !statusEl || !rpmEl) {
                    requiresFullRender = true;
                    return;
                }

                container.style.background = isRunning ? '#d4edda' : '#f8d7da';
                container.style.borderColor = isRunning ? '#c3e6cb' : '#f5c6cb';
                
                statusEl.style.color = isRunning ? '#155724' : '#721c24';
                statusEl.style.fontWeight = isRunning ? 'bold' : 'normal';
                statusEl.innerText = `Trạng thái: ${isRunning ? '🟢 Đang chạy' : '🔴 Dừng'}`;
                
                rpmEl.innerText = conv.rpm || 0;
            });
        }

        // Update Motors Softly
        if (machine.motors) {
            const eVal = machine.motors.enabled;
            const isEnabled = eVal === 1 || eVal === "1" || eVal === true || eVal === "true";

            const enableStatusEl = document.getElementById(`motor-enable-status-${mIdx}`);
            const enableBtnEl = document.getElementById(`motor-enable-btn-${mIdx}`);

            if (!enableStatusEl || !enableBtnEl) {
                requiresFullRender = true;
                return;
            }

            enableStatusEl.style.background = isEnabled ? '#d4edda' : '#e2e3e5';
            enableStatusEl.style.color = isEnabled ? '#155724' : '#383d41';
            enableStatusEl.style.borderColor = isEnabled ? '#c3e6cb' : '#d6d8db';
            enableStatusEl.innerText = isEnabled ? '✅ Hệ thống Kích hoạt' : '❌ Hệ thống Vô hiệu hóa';
            enableBtnEl.innerText = isEnabled ? 'Disable Toàn bộ' : 'Enable Toàn bộ';

            const motorKeys = Object.keys(machine.motors).filter(k => k.startsWith('motor_'));
            motorKeys.forEach(moKey => {
                const motor = machine.motors[moKey];
                const isOn = parseInt(motor.state) === 1;

                const activeView = document.getElementById(`motor-active-view-${mIdx}-${moKey}`);
                const disabledView = document.getElementById(`motor-disabled-view-${mIdx}-${moKey}`);
                const stateTextEl = document.getElementById(`motor-state-text-${mIdx}-${moKey}`);
                const btnEl = document.getElementById(`motor-btn-${mIdx}-${moKey}`);

                if (!activeView || !disabledView || !stateTextEl || !btnEl) {
                    requiresFullRender = true;
                    return;
                }

                if (isEnabled) {
                    activeView.style.display = 'block';
                    disabledView.style.display = 'none';
                    stateTextEl.innerHTML = isOn ? '<span style="color: #28a745;">🟢 Đang chạy (ON)</span>' : '<span style="color: #dc3545;">🔴 Đã dừng (OFF)</span>';
                    btnEl.style.background = isOn ? '#dc3545' : '#28a745';
                    btnEl.innerText = isOn ? 'TẮT ĐỘNG CƠ' : 'BẬT ĐỘNG CƠ';
                } else {
                    activeView.style.display = 'none';
                    disabledView.style.display = 'block';
                }
            });
        }
    });

    return !requiresFullRender;
}

// ==========================================
// 7. CÁC HÀM TƯƠNG TÁC
// ==========================================
window.togglecomponent = function(machineIdx, convKey) {
    const component = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx].inputs[convKey];
    component.status = parseInt(component.status) === 1 ? 0 : 1;
    saveSystemData();
    if (!updateDashboardData()) viewStorageDashboard();
}

window.toggleMotorEnable = function(machineIdx) {
    const motors = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx].motors;
    const currentlyEnabled = motors.enabled === 1 || motors.enabled === "1" || motors.enabled === true;
    
    motors.enabled = currentlyEnabled ? 0 : 1;
    if (!motors.enabled) {
        Object.keys(motors).forEach(k => {
            if (k.startsWith('motor_')) motors[k].state = 0;
        });
    }
    saveSystemData();
    if (!updateDashboardData()) viewStorageDashboard();
}

window.toggleMotorState = function(machineIdx, motorKey) {
    const motor = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx].motors[motorKey];
    motor.state = parseInt(motor.state) === 1 ? 0 : 1;
    saveSystemData();
    if (!updateDashboardData()) viewStorageDashboard();
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
// 9. CƠ CHẾ ĐỒNG BỘ THỜI GIAN THỰC (KÉP)
// ==========================================
function processIncomingData(updatedData) {
    if (!currentUser) return;

    console.log("📡 Incoming realtime update", updatedData);

    // Replace old data completely
    systemData = updatedData;

    // Re-render dropdowns
    populateFactories();

    // Restore selected values
    if (selectedFactoryIndex !== null && selectedFactoryIndex !== "") {
        factorySelect.value = selectedFactoryIndex;
        loadStorages();
    }

    if (selectedStorageIndex !== null && selectedStorageIndex !== "") {
        storageSelect.value = selectedStorageIndex;
        loadMachines();
    }

    if (selectedMachineIndex !== null && selectedMachineIndex !== "") {
        machineSelect.value = selectedMachineIndex;
    }

    // FORCE FULL DASHBOARD RENDER
    viewStorageDashboard();
}

const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true
});

socket.on('system-data-updated', processIncomingData);

// BẢO HIỂM POLLING VỚI CACHE-BUSTING
setInterval(async () => {
    if (!currentUser || selectedStorageIndex === null || selectedStorageIndex === "") return;
    
    try {
        const response = await fetch('/api/load-data?_t=' + new Date().getTime(), {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        if (response.ok) {
            const freshData = await response.json();
            processIncomingData(freshData);
        }
    } catch (err) {}
}, 500);