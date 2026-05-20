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
        
        // Cập nhật thẻ h3 hiển thị thêm IP và đổi text nút bấm
        html += `
        <div class="machine-block" style="position: relative; border: 1px solid #ccc; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-top:0; border-bottom: 1px solid #eee; padding-bottom:10px; padding-right: 120px;">
                ${machine.name} <span style="font-size: 0.6em; color: gray; font-weight: normal;">(ID: ${machine.id} | IP: ${machine.ip || 'Trống'})</span>
            </h3>
            
            <button class="mgmt-btn admin-only" style="position: absolute; top: 12px; right: 15px; background-color: #ffc107; color: black; padding: 5px 15px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;" onclick="editMachineDetails(${mIdx})">
                Sửa ID / IP
            </button>
            
            <h4 style="margin: 10px 0;">Inputs</h4>
            <div class="component-mini-grid" style="display:flex; gap: 15px; flex-wrap: wrap; margin-bottom: 20px;">`;
        
        if (machine.inputs) {
            Object.entries(machine.inputs).forEach(([cKey, conv]) => {
                console.log(`${mIdx}, '${cKey}'`);
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
                console.log(`mIdx : ${mIdx} - moKey : ${moKey}`)
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
}

// ==========================================
// 7. CÁC HÀM TƯƠNG TÁC (COMMANDS)
// ==========================================
window.togglecomponent = function(machineIdx, convKey) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    const factory_id = systemData.factories[selectedFactoryIndex].id;
    const storage_id = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].id;
    const machine_type = machine.type;
    const machine_id = machine.id;
    const component = machine.inputs[convKey];
    component.status = parseInt(component.status) === 1 ? 0 : 1;
    fetch(`/toggleInputState?factory_id=${factory_id}&storage_id=${storage_id}&machine_id=${machine_id}&machine_type=${machine_type}&input_id=${convKey}&input_state=${component.status}`)
    saveSystemData();
}

window.toggleMotorState = function(machineIdx, motorKey) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    const factory_id = systemData.factories[selectedFactoryIndex].id;
    const storage_id = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].id;
    const machine_type = machine.type;
    const machine_id = machine.id;
    const motor = machine.motors[motorKey];
    motor.state = parseInt(motor.state) === 1 ? 0 : 1;
    fetch(`/toggleMotorState?factory_id=${factory_id}&storage_id=${storage_id}&machine_id=${machine_id}&machine_type=${machine_type}&motor_id=${motorKey}&motor_state=${motor.state}`)
    saveSystemData();
}

window.toggleMotorEnable = function(machineIdx) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    
    if (machine.motors) {
        const currentState = machine.motors.enabled;
        let newState;
        
        if (typeof currentState === 'boolean') {
            newState = !currentState;
        } else {
            newState = parseInt(currentState) === 1 ? 0 : 1;
        }
        
        machine.motors.enabled = newState;
        saveSystemData();
        viewStorageDashboard(); 
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

// ==========================================
// 9. QUẢN LÝ THÊM / XÓA / SỬA (ADMIN ONLY)
// ==========================================

function checkAdminAccess() {
    if (!currentUser || currentUser.role !== 'admin') {
        alert("Thao tác bị từ chối: Chỉ Administrator mới có quyền thực hiện!");
        return false;
    }
    return true;
}

// --- QUẢN LÝ NHÀ MÁY (FACTORY) ---

function addFactory() {
    if (!checkAdminAccess()) return;
    
    const factoryName = prompt("Nhập TÊN Nhà máy mới (Name):");
    if (!factoryName || factoryName.trim() === "") return;

    const factoryId = prompt("Nhập ID Nhà máy mới (ID - Không có khoảng trắng):", "Factory_X");
    if (!factoryId || factoryId.trim() === "") return;

    if (!systemData) systemData = { factories: [] };
    if (!systemData.factories) systemData.factories = [];
    
    systemData.factories.push({
        id: factoryId.trim(),
        name: factoryName.trim(),
        storageUnits: []
    });
    
    saveSystemData();
    populateFactories();
}

function deleteFactory() {
    if (!checkAdminAccess()) return;
    
    if (selectedFactoryIndex === "" || selectedFactoryIndex === null) {
        alert("Vui lòng chọn một nhà máy để xóa!");
        return;
    }
    
    const factory = systemData.factories[selectedFactoryIndex];
    if (confirm(`Bạn có chắc chắn muốn xóa nhà máy "${factory.name}" và toàn bộ dữ liệu bên trong không?`)) {
        systemData.factories.splice(selectedFactoryIndex, 1);
        selectedFactoryIndex = ""; 
        
        saveSystemData();
        populateFactories();
        loadStorages(); 
    }
}

// --- QUẢN LÝ KHO (STORAGE) ---

function addStorage() {
    if (!checkAdminAccess()) return;
    
    if (selectedFactoryIndex === "" || selectedFactoryIndex === null) {
        alert("Vui lòng chọn một nhà máy trước khi thêm kho!");
        return;
    }

    const storageName = prompt("Nhập TÊN Kho mới (Name):");
    if (!storageName || storageName.trim() === "") return;

    const storageId = prompt("Nhập ID Kho mới (ID - Không có khoảng trắng):", "Warehouse_X");
    if (!storageId || storageId.trim() === "") return;

    const factory = systemData.factories[selectedFactoryIndex];
    if (!factory.storageUnits) factory.storageUnits = [];
    
    factory.storageUnits.push({
        id: storageId.trim(),
        name: storageName.trim(),
        machineUnits: []
    });
    
    saveSystemData();
    loadStorages();
    storageSelect.value = factory.storageUnits.length - 1;
    loadMachines(); 
}

function deleteStorage() {
    if (!checkAdminAccess()) return;
    
    if (selectedFactoryIndex === "" || selectedStorageIndex === "" || selectedStorageIndex === null) {
        alert("Vui lòng chọn một kho để xóa!");
        return;
    }

    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    if (confirm(`Bạn có chắc chắn muốn xóa kho "${storage.name}" và các máy bên trong không?`)) {
        systemData.factories[selectedFactoryIndex].storageUnits.splice(selectedStorageIndex, 1);
        selectedStorageIndex = ""; 
        
        saveSystemData();
        loadStorages();
    }
}

// --- QUẢN LÝ MÁY (MACHINE) ---

function addMachine() {
    if (!checkAdminAccess()) return;
    
    if (selectedStorageIndex === "" || selectedStorageIndex === null) {
        alert("Vui lòng chọn một kho trước khi thêm máy!");
        return;
    }

    const machineName = prompt("Nhập TÊN Máy mới (Name):", "Machine_New");
    if (!machineName || machineName.trim() === "") return;

    const machineId = prompt("Nhập ID Máy mới (ID):", "Machine_X");
    if (!machineId || machineId.trim() === "") return;

    const machineType = prompt("Nhập loại máy (Type):", "scsc");
    const machineIp = prompt("Nhập địa chỉ IP máy:", "192.168.1.100");

    const numInputsStr = prompt("Nhập số lượng Inputs cho máy này (VD: 4):", "4");
    const numInputs = parseInt(numInputsStr) || 0;

    const numMotorsStr = prompt("Nhập số lượng Motors cho máy này (VD: 2):", "2");
    const numMotors = parseInt(numMotorsStr) || 0;

    let inputsObj = {};
    for (let i = 1; i <= numInputs; i++) {
        inputsObj[`input_${i}`] = {
            name: `INPUT ${i}`,
            rpm: 0,
            status: 0
        };
    }

    let motorsObj = {
        control_mode: 0,
        enabled: 0
    };
    for (let i = 1; i <= numMotors; i++) {
        motorsObj[`motor_${i}`] = {
            name: `Motor ${i}`,
            state: 0
        };
    }

    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    if (!storage.machineUnits) storage.machineUnits = [];
    
    storage.machineUnits.push({
        id: machineId.trim(),
        name: machineName.trim(),
        type: machineType ? machineType.trim() : "",
        ip: machineIp ? machineIp.trim() : "",
        inputs: inputsObj,
        motors: motorsObj
    });
    
    saveSystemData();
    loadMachines();
}

function deleteMachine() {
    if (!checkAdminAccess()) return;
    
    if (selectedMachineIndex === "" || selectedMachineIndex === null) {
        alert("Vui lòng chọn một máy cụ thể trong dropdown để xóa!");
        return;
    }

    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    const machine = storage.machineUnits[selectedMachineIndex];
    
    if (confirm(`Bạn có chắc chắn muốn xóa máy "${machine.name}" không?`)) {
        storage.machineUnits.splice(selectedMachineIndex, 1);
        selectedMachineIndex = ""; 
        
        saveSystemData();
        loadMachines();
    }
}

// Cập nhật hàm Edit ID cũ thành Edit ID & IP với validation
window.editMachineDetails = function(machineIdx) {
    if (!checkAdminAccess()) return;
    
    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    const machine = storage.machineUnits[machineIdx];
    
    // --- 1. XỬ LÝ SỬA ID ---
    let newId = prompt(`Sửa ID cho máy "${machine.name}":\n(ID hiện tại: ${machine.id})`, machine.id);
    if (newId === null) return; // Hủy thao tác
    newId = newId.trim();

    if (newId !== "" && newId !== machine.id) {
        // Kiểm tra xem ID mới có bị trùng với máy NÀO KHÁC trong cùng kho không
        const isDuplicate = storage.machineUnits.some((m, idx) => m.id === newId && idx !== machineIdx);
        if (isDuplicate) {
            alert(`Lỗi: ID "${newId}" đã được sử dụng bởi một máy khác trong kho này. Vui lòng chọn ID khác!`);
            return; 
        }
    } else {
        newId = machine.id; // Nếu để trống hoặc không đổi thì giữ nguyên
    }

    // --- 2. XỬ LÝ SỬA IP ---
    let currentIp = machine.ip || "";
    let newIp = prompt(`Sửa IP cho máy "${machine.name}":\n(IP hiện tại: ${currentIp})`, currentIp);
    if (newIp === null) return; // Hủy thao tác
    newIp = newIp.trim();

    if (newIp !== "" && newIp !== currentIp) {
        // Kiểm tra định dạng IPv4 chuẩn (VD: 192.168.1.1)
        const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        
        if (!ipv4Regex.test(newIp)) {
            alert(`Lỗi: IP "${newIp}" không hợp lệ. Vui lòng nhập đúng định dạng IPv4 (Ví dụ: 192.168.1.100).`);
            return;
        }
    } else {
        newIp = currentIp; // Giữ nguyên nếu trống
    }

    // --- 3. LƯU THAY ĐỔI ---
    if (newId !== machine.id || newIp !== currentIp) {
        machine.id = newId;
        machine.ip = newIp;
        saveSystemData(); 
        
        alert(`Thành công!\nID: ${newId}\nIP: ${newIp}`);
        saveSystemData();
        loadMachines();
        viewStorageDashboard(); // Render lại dashboard để thấy thay đổi
    } else {
        alert("Không có thay đổi nào được lưu.");
    }
}
/*function getDatafromESP(){
    console.log("Getting Data from ESP");
    fetch('/status').then(r => r.json()).then(d => {
        
    })
}
setInterval(getDatafromESP,2000)*/