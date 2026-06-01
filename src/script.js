// ==========================================
// 1. INITIALIZATION & STATE
// ==========================================
let systemData = null;
let currentUser = null; 
let mqttClient = null;

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
// 2. AUTHENTICATION
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
// 3. DATA FETCHING & SAVING
// ==========================================
async function loadSystemData() {
    try {
        const response = await fetch('/api/load-data');
        if (!response.ok) throw new Error('Failed to load data');
        
        systemData = await response.json();
        populateFactories();
        
        if (selectedFactoryIndex !== null && selectedFactoryIndex !== "") {
            loadStorages();
        }
    } catch (error) {
        console.error('❌ Lỗi khi tải dữ liệu:', error);
    }
}

async function saveSystemData() {
    try {
        const response = await fetch('/api/save-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(systemData)
        });
        
        if (!response.ok) throw new Error('Failed to save data to server');
        console.log('✅ Dữ liệu đã được lưu thành công');
    } catch (error) {
        console.error('❌ Lỗi khi lưu dữ liệu:', error);
        localStorage.setItem('monitorSystemData', JSON.stringify(systemData));
    }
}

// ==========================================
// 4. DROPDOWN NAVIGATION
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
// 5. DASHBOARD RENDER & SYNC
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
        <div class="machine-block" style="position: relative; border: 1px solid #ccc; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-top:0; border-bottom: 1px solid #eee; padding-bottom:10px; padding-right: 120px;">
                ${machine.name} <span style="font-size: 0.6em; color: gray; font-weight: normal;">(ID: ${machine.id} | IP: ${machine.ip || 'Trống'})</span>
            </h3>
            
            <button class="mgmt-btn" style="position: absolute; top: 12px; right: 130px; background-color: #ffc107; color: black; padding: 5px 15px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;" onclick="openMachineControl('${machine.ip}')">
                OPEN MACHINE CONTROL
            </button>
            <button class="mgmt-btn admin-only" style="position: absolute; top: 12px; right: 15px; background-color: #ffc107; color: black; padding: 5px 15px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;" onclick="editMachineDetails(${mIdx})">
                Sửa ID / IP
            </button>
            
            <h4 style="margin: 10px 0;">Outputs</h4>
            <div class="component-mini-grid" style="display:flex; gap: 15px; flex-wrap: wrap; margin-bottom: 20px;">`;
        
        if (machine.outputs) {
            Object.entries(machine.outputs).forEach(([cKey, conv]) => {
                const isRunning = parseInt(conv.status) === 1;
                html += `
                <div id="output-container-${mIdx}-${cKey}" class="conv-item" style="flex:1; min-width: 150px; border: 1px solid #ddd; padding: 12px; border-radius: 6px; background: ${isRunning ? '#d4edda' : '#f8d7da'}; transition: background 0.3s;">
                    <strong style="display:block; margin-bottom:5px;">${conv.name || cKey}</strong>
                    <p id="output-status-${mIdx}-${cKey}" style="margin:5px 0;">Trạng thái: ${isRunning ? '🟢 Đang chạy' : '🔴 Dừng'}</p>
                    <p style="margin:5px 0;">Tốc độ: <span id="output-rpm-${mIdx}-${cKey}" style="font-weight:bold;">${conv.rpm || 0}</span> RPM</p>
                    <button id="output-btn-${mIdx}-${cKey}" style="width:100%; background:${isRunning ? '#dc3545' : '#28a745'}; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold;" onclick="togglecomponent(${mIdx}, '${cKey}')">
                        ${isRunning ? 'Tắt' : 'Bật'}
                    </button>
                </div>`;
            });
        }
        
        html += `</div>
            <h4 style="margin: 10px 0;">Động cơ (Motors)</h4>`;
        
        if (machine.motors) {
            const isMotorsEnabled = machine.motors.enabled === true || parseInt(machine.motors.enabled) === 1;
            
            html += `
            <div style="margin-bottom: 15px;">
                <button id="motor-enable-btn-${mIdx}" style="background:${isMotorsEnabled ? '#6c757d' : '#007bff'}; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;" onclick="toggleMotorEnable(${mIdx})">
                    ${isMotorsEnabled ? 'Vô hiệu hóa toàn bộ Motors (Disable)' : 'Kích hoạt Motors (Enable)'}
                </button>
            </div>
            
            <div id="motor-list-container-${mIdx}" class="component-mini-grid" style="display:${isMotorsEnabled ? 'flex' : 'none'}; gap: 15px; flex-wrap: wrap;">`;

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
            html += `</div>`; 
        }
        html += `</div>`; 
    });
    html += `</div>`;
    detailsContent.innerHTML = html;
}

function updateDashboardData() {
    if (!systemData || selectedStorageIndex === "") return;
    
    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    storage.machineUnits.forEach((machine, mIdx) => {
        // Sync Outputs
        if (machine.outputs) {
            Object.entries(machine.outputs).forEach(([cKey, conv]) => {
                const isRunning = parseInt(conv.status) === 1;
                const container = document.getElementById(`output-container-${mIdx}-${cKey}`);
                const statusEl = document.getElementById(`output-status-${mIdx}-${cKey}`);
                const rpmEl = document.getElementById(`output-rpm-${mIdx}-${cKey}`);
                const btnEl = document.getElementById(`output-btn-${mIdx}-${cKey}`);

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
            const enableBtnEl = document.getElementById(`motor-enable-btn-${mIdx}`);
            const motorListContainer = document.getElementById(`motor-list-container-${mIdx}`);
            
            if (enableBtnEl && motorListContainer) {
                enableBtnEl.style.background = isMotorsEnabled ? '#6c757d' : '#007bff';
                enableBtnEl.innerText = isMotorsEnabled ? 'Vô hiệu hóa toàn bộ Motors (Disable)' : 'Kích hoạt Motors (Enable)';
                motorListContainer.style.display = isMotorsEnabled ? 'flex' : 'none';
            }

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

    // Update timestamp
    const timeEl = document.getElementById('dashboard-time');
    if (timeEl) timeEl.innerText = `Cập nhật lúc: ${new Date().toLocaleTimeString()}`;
}

// ==========================================
// 6. MACHINE CONTROL COMMANDS
// ==========================================
function openMachineControl(machine_ip) {
    if (!machine_ip || machine_ip.trim() === "") {
        alert("Máy này chưa được cấu hình địa chỉ IP!");
        return;
    }
    let url = machine_ip.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
    }
    window.open(url, '_blank');
}

window.togglecomponent = function(machineIdx, convKey) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    const factory_id = systemData.factories[selectedFactoryIndex].id;
    const storage_id = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].id;
    
    machine.outputs[convKey].status = parseInt(machine.outputs[convKey].status) === 1 ? 0 : 1;
    fetch(`/toggleOutputState?factory_id=${factory_id}&storage_id=${storage_id}&machine_id=${machine.id}&machine_type=${machine.type}&output_id=${convKey}&output_state=${machine.outputs[convKey].status}`);
    saveSystemData();
}

window.toggleMotorState = function(machineIdx, motorKey) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    const factory_id = systemData.factories[selectedFactoryIndex].id;
    const storage_id = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].id;
    
    machine.motors[motorKey].state = parseInt(machine.motors[motorKey].state) === 1 ? 0 : 1;
    fetch(`/toggleMotorState?factory_id=${factory_id}&storage_id=${storage_id}&machine_id=${machine.id}&machine_type=${machine.type}&motor_id=${motorKey}&motor_state=${machine.motors[motorKey].state}`);
    saveSystemData();
}

window.toggleMotorEnable = function(machineIdx) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    if (machine.motors) {
        machine.motors.enabled = parseInt(machine.motors.enabled) === 1 ? 0 : 1;
        saveSystemData();
        viewStorageDashboard(); 
    }
}

// ==========================================
// 7. WEBSOCKET (MQTT) INTEGRATION
// ==========================================
function initializeMQTTConnection() {
    const clientId = 'monitor-client-' + Math.random().toString(36).substring(7);
    const host = 'ws://localhost:9001/mqtt'; 
    
    mqttClient = mqtt.connect(host, {
        keepalive: 60,
        username: 'amt',
        password: 'amt123456',
        clientId: clientId,
        clean: true,
        reconnectPeriod: 1000
    });
    
    mqttClient.on('connect', () => {
        console.log('✅ UI MQTT Connected:', clientId);
        mqttClient.subscribe('system/data/update', { qos: 0 });
    });
    
    mqttClient.on('message', (topic, message) => {
        try {
            if (topic === 'system/data/update') {
                const updatedData = JSON.parse(message.toString());
                if (updatedData && updatedData.factories) {
                    systemData = updatedData;
                    updateDashboardData();
                }
            }
        } catch (error) {
            console.error('❌ Error parsing broadcast message:', error);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const savedSession = localStorage.getItem('monitorSession');
    if (savedSession) {
        currentUser = JSON.parse(savedSession);
        startApp();
        setTimeout(initializeMQTTConnection, 500);
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }
});

// ==========================================
// 8. ADMIN MANAGEMENT 
// ==========================================
function checkAdminAccess() {
    if (!currentUser || currentUser.role !== 'admin') {
        alert("Thao tác bị từ chối: Chỉ Administrator mới có quyền thực hiện!");
        return false;
    }
    return true;
}

function addFactory() {
    if (!checkAdminAccess()) return;
    const factoryName = prompt("Nhập TÊN Nhà máy mới (Name):");
    const factoryId = prompt("Nhập ID Nhà máy mới (ID - Không có khoảng trắng):", "Factory_X");
    
    if (!factoryName || !factoryId) return;
    if (!systemData.factories) systemData.factories = [];
    
    systemData.factories.push({ id: factoryId.trim(), name: factoryName.trim(), storageUnits: [] });
    saveSystemData();
    populateFactories();
}

function deleteFactory() {
    if (!checkAdminAccess() || selectedFactoryIndex === "" || selectedFactoryIndex === null) return alert("Chọn một nhà máy để xóa!");
    
    const factory = systemData.factories[selectedFactoryIndex];
    if (confirm(`Bạn có chắc chắn muốn xóa nhà máy "${factory.name}"?`)) {
        systemData.factories.splice(selectedFactoryIndex, 1);
        selectedFactoryIndex = ""; 
        saveSystemData();
        populateFactories();
        loadStorages(); 
    }
}

function addStorage() {
    if (!checkAdminAccess() || selectedFactoryIndex === "" || selectedFactoryIndex === null) return alert("Chọn nhà máy trước khi thêm kho!");
    
    const storageName = prompt("Nhập TÊN Kho mới (Name):");
    const storageId = prompt("Nhập ID Kho mới (ID):", "Warehouse_X");
    
    if (!storageName || !storageId) return;
    const factory = systemData.factories[selectedFactoryIndex];
    if (!factory.storageUnits) factory.storageUnits = [];
    
    factory.storageUnits.push({ id: storageId.trim(), name: storageName.trim(), machineUnits: [] });
    saveSystemData();
    loadStorages();
}

function deleteStorage() {
    if (!checkAdminAccess() || selectedStorageIndex === "" || selectedStorageIndex === null) return alert("Chọn một kho để xóa!");
    
    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    if (confirm(`Xóa kho "${storage.name}"?`)) {
        systemData.factories[selectedFactoryIndex].storageUnits.splice(selectedStorageIndex, 1);
        selectedStorageIndex = ""; 
        saveSystemData();
        loadStorages();
    }
}

function addMachine() {
    if (!checkAdminAccess() || selectedStorageIndex === "" || selectedStorageIndex === null) return alert("Chọn kho trước khi thêm máy!");

    const machineName = prompt("Nhập TÊN Máy mới:", "Machine_New");
    const machineId = prompt("Nhập ID Máy mới:", "Machine_X");
    const machineType = prompt("Nhập loại máy:", "scsc");
    const machineIp = prompt("Nhập địa chỉ IP máy:", "192.168.1.100");
    
    if (!machineName || !machineId) return;

    let outputsObj = {};
    for (let i = 1; i <= (parseInt(prompt("Số lượng Outputs:", "4")) || 0); i++) {
        outputsObj[`output_${i}`] = { name: `OUTPUT ${i}`, rpm: 0, status: 0 };
    }

    let motorsObj = { control_mode: 0, enabled: 0 };
    for (let i = 1; i <= (parseInt(prompt("Số lượng Motors:", "2")) || 0); i++) {
        motorsObj[`motor_${i}`] = { name: `Motor ${i}`, state: 0 };
    }

    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    if (!storage.machineUnits) storage.machineUnits = [];
    
    storage.machineUnits.push({
        id: machineId.trim(),
        name: machineName.trim(),
        type: machineType ? machineType.trim() : "",
        ip: machineIp ? machineIp.trim() : "",
        outputs: outputsObj,
        motors: motorsObj
    });
    
    saveSystemData();
    loadMachines();
}

function deleteMachine() {
    if (!checkAdminAccess() || selectedMachineIndex === "" || selectedMachineIndex === null) return alert("Chọn một máy để xóa!");

    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    if (confirm(`Xóa máy "${storage.machineUnits[selectedMachineIndex].name}"?`)) {
        storage.machineUnits.splice(selectedMachineIndex, 1);
        selectedMachineIndex = ""; 
        saveSystemData();
        loadMachines();
    }
}

window.editMachineDetails = function(machineIdx) {
    if (!checkAdminAccess()) return;
    
    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    const machine = storage.machineUnits[machineIdx];
    
    let newId = prompt(`Sửa ID cho máy "${machine.name}":\n(ID hiện tại: ${machine.id})`, machine.id);
    if (newId === null) return; 
    newId = newId.trim();

    if (newId !== "" && newId !== machine.id) {
        if (storage.machineUnits.some((m, idx) => m.id === newId && idx !== machineIdx)) {
            return alert(`Lỗi: ID "${newId}" đã bị trùng trong kho này.`);
        }
    } else newId = machine.id;

    let newIp = prompt(`Sửa IP cho máy:\n(IP hiện tại: ${machine.ip || ""})`, machine.ip || "");
    if (newIp === null) return; 
    newIp = newIp.trim();

    if (newIp !== "" && newIp !== machine.ip) {
        if (!/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(newIp)) {
            return alert("Lỗi: IP không hợp lệ.");
        }
    } else newIp = machine.ip;

    if (newId !== machine.id || newIp !== machine.ip) {
        machine.id = newId;
        machine.ip = newIp;
        saveSystemData();
        loadMachines();
        viewStorageDashboard();
    }
}