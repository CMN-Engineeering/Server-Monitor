// ==========================================
// 1. KHỞI TẠO BIẾN VÀ CẤU TRÚC DỮ LIỆU
// ==========================================
let systemData = null;
let currentUser = null; 

let selectedFactoryIndex = null;
let selectedStorageIndex = null;
let selectedTypeIndex = null;
let selectedMachineIndex = null;

const factorySelect = document.getElementById('factory-select');
const storageSelect = document.getElementById('storage-select');
const typeSelect = document.getElementById('type-select');
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

function logout(i) {
    let confirmed = i == 0 ?  confirm("Bạn có chắc chắn muốn đăng xuất không?") : true;
    if (confirmed) {
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
        const response = await fetch('/api/load-data');
        if (!response.ok) throw new Error('Failed to load data');
        systemData = await response.json();
        populateFactories();
        
        if (selectedFactoryIndex !== null && selectedFactoryIndex !== "") {
            loadStorages();
        }
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu:', error);
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
    } catch (error) {
        console.error('❌ Lỗi khi lưu dữ liệu:', error);
        localStorage.setItem('monitorSystemData', JSON.stringify(systemData));
    }
}

// ==========================================
// 4. ĐIỀU HƯỚNG DROPDOWN CASCADE
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
    typeSelect.innerHTML = '<option value="">-- Chọn loại máy --</option>';
    machineSelect.innerHTML = '<option value="">-- Chọn máy --</option>';
    selectedFactoryIndex = factorySelect.value;
    selectedStorageIndex = "";
    selectedTypeIndex = "";
    selectedMachineIndex = "";
    
    if (selectedFactoryIndex !== "") {
        const factory = systemData.factories[selectedFactoryIndex];
        (factory.storageUnits || []).forEach((storage, index) => {
            storageSelect.add(new Option(storage.name, index));
        });
    }
    viewStorageDashboard();
}

function loadTypes() {
    typeSelect.innerHTML = '<option value="">-- Chọn loại máy --</option>';
    machineSelect.innerHTML = '<option value="">-- Chọn máy --</option>';
    selectedStorageIndex = storageSelect.value;
    selectedTypeIndex = "";
    selectedMachineIndex = "";

    if (selectedStorageIndex !== "") {
        const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
        (storage.machine_types || []).forEach((typeObj, index) => {
            typeSelect.add(new Option(typeObj.type, index));
        });
    }
    viewStorageDashboard();
}

function loadMachines() {
    machineSelect.innerHTML = '<option value="">-- Chọn máy --</option>';
    selectedTypeIndex = typeSelect.value;
    selectedMachineIndex = "";

    if (selectedTypeIndex !== "") {
        const typeObj = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machine_types[selectedTypeIndex];
        (typeObj.machineUnits || []).forEach((machine, index) => {
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
// 5. DASHBOARD FULL RENDER (3 PARTS)
// ==========================================
function openPage(url){
    window.open(url, '_blank');
}
function viewStorageDashboard() {
    if (selectedFactoryIndex === "" || selectedStorageIndex === "" || selectedTypeIndex === "") {
        detailsContent.innerHTML = "";
        detailsTitle.innerHTML = "Chọn Nhà máy, Kho và Loại Máy để xem Dashboard";
        return;
    }
    
    const typeObj = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machine_types[selectedTypeIndex];
    let machinesToRender = [];
    
    if (selectedMachineIndex !== "" && selectedMachineIndex !== null) {
        machinesToRender.push({ machine: typeObj.machineUnits[selectedMachineIndex], originalIdx: parseInt(selectedMachineIndex) });
    } else {
        machinesToRender = typeObj.machineUnits.map((m, i) => ({ machine: m, originalIdx: i }));
    }
    
    detailsTitle.innerHTML = `Dashboard: ${typeObj.type} <span style="font-size:0.6em; color:gray; float:right;">Cập nhật lúc: ${new Date().toLocaleTimeString()}</span>`;
    
    let html = `<div class="machine-grid">`;
    machinesToRender.forEach((item) => {
        const machine = item.machine;
        const mIdx = item.originalIdx;
        
        html += `
        <div class="machine-block" style="position: relative; border: 1px solid #ccc; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="display:flex;justify-content: space-between;flex-direction:row">
                <div style="display:block">
                        <h3 style="margin-top:0; margin-bottom: 10px;">General Information</h3>
                        <div><strong>Name:</strong> ${machine.name || 'N/A'}</div>
                        <div><strong>ID:</strong> ${machine.id || 'N/A'}</div>
                        <div><strong>IP:</strong> ${machine.ip || 'N/A'}</div>
                        <div><strong>PID:</strong> <span id="info-pid-${mIdx}">${machine.pid || 'N/A'}</span></div>
                        <div><strong>EID:</strong> <span id="info-eid-${mIdx}">${machine.eid || 'N/A'}</span></div>
                        <div><strong>MID:</strong> <span id="info-mid-${mIdx}">${machine.mid || 'N/A'}</span></div>
                        <div><strong>CF:</strong> <span id="info-cf-${mIdx}">${machine.cf || 'N/A'}</span></div>
                        <div>
                    </div>
                    <div style="margin-top: 10px;display:flex;flex-direction:column;height:100px;justify-content: space-evenly;">
                        <button class="mgmt-btn" style="background-color: #ffc107; color: black;cursor:pointer" onclick="openMachineControl('${machine.ip}')">Mở Control Máy</button>
                        <button class="mgmt-btn" style="background-color: #ffc107; color: black;cursor:pointer" onclick="openPage('${machine.sheet_link}')">Mở Sheet Báo Cáo</button>
                        <button class="mgmt-btn" style="background-color: #ffc107; color: black;cursor:pointer" onclick="openPage('${machine.looker_link}')">Mở Đồ Thị Báo Cáo</button>
                        <button class="mgmt-btn admin-only" style="background-color: #ffc107; color: black;cursor:pointer" onclick="editMachineDetails(${mIdx})">Sửa Thông Tin</button>
                    </div>
                </div>
                <div id="amount-card" style="display: flex;align-items: center;justify-content: flex-start;flex-direction: column;">
                    <h3 style="margin-top:0; margin-bottom: 10px;">Amount</h3>
                    <div style = "background: #97c4f55e;width: 200px;height: max-content;display: flex;align-items: center;justify-content: center;padding: 15px;margin: 10px;border-radius: 15px;">
                        <strong style="display:block; margin-bottom:5px;" id="info-qraw-${mIdx}">QRAW : ${machine.qraw || 0}</strong>
                    </div>
                    <div style = "background: #97c4f55e;width: 200px;height: max-content;display: flex;align-items: center;justify-content: center;padding: 15px;margin: 10px;border-radius: 15px;">
                        <strong style="display:block; margin-bottom:5px;" id="info-qfinal-${mIdx}">QFINAL : ${machine.qfinal || 0}</strong>
                    </div>
                </div>
            
            <div id="motor-control-card" style="display:flex;justify-content:center;flex-direction: column;">`;
        
        if (machine.motors) {
            const isMotorsEnabled = machine.motors.enabled === true || parseInt(machine.motors.enabled) === 1;
            html += `
            <div style="margin-bottom: 15px;">
                <button id="motor-enable-btn-${mIdx}" style="background:${isMotorsEnabled ? '#6c757d' : '#007bff'}; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;" onclick="toggleMotorEnable(${mIdx})">
                    ${isMotorsEnabled ? 'Vô hiệu hóa toàn bộ Motors' : 'Kích hoạt Motors'}
                </button>
            </div>
            <div id="motor-list-container-${mIdx}" class="component-mini-grid" style="display:${isMotorsEnabled ? 'flex' : 'none'}; gap: 15px; flex-wrap: wrap;flex-direction: column;">`;

            const motorKeys = Object.keys(machine.motors).filter(k => k.startsWith('motor_'));
            motorKeys.forEach(moKey => {
                const motor = machine.motors[moKey];
                const isOn = parseInt(motor.state) === 1;
                html += `
                <div id="motor-container-${mIdx}-${moKey}" class="motor-item" style="flex:1; min-width: 150px; border: 1px solid #ddd; padding: 12px; border-radius: 6px; background: ${isOn ? '#d4edda' : '#f8d7da'};">
                    <strong style="display:block; margin-bottom:5px;">${motor.name || moKey}</strong>
                    <p id="motor-status-${mIdx}-${moKey}" style="margin:5px 0;">Trạng thái: ${isOn ? '🟢 Đang chạy' : '🔴 Dừng'}</p>
                    <button id="motor-btn-${mIdx}-${moKey}" style="width:100%; background:${isOn ? '#dc3545' : '#28a745'}; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;" onclick="toggleMotorState(${mIdx}, '${moKey}')">
                        ${isOn ? 'Tắt' : 'Bật'}
                    </button>
                </div>`;
            });
            html += `</div></div></div></div>`; 
        }
    });
    html += `</div>`;
    detailsContent.innerHTML = html;
}
// ==========================================
// 6. SOFT UPDATE (UI SYNC)
// ==========================================
function updateDashboardData() {
    if (!systemData || selectedTypeIndex === "") return;
    
    const typeObj = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machine_types[selectedTypeIndex];
    typeObj.machineUnits.forEach((machine, mIdx) => {
        if (machine.outputs) {
            Object.entries(machine.outputs).forEach(([cKey, conv]) => {
                const isRunning = parseInt(conv.status) === 1;
                const container = document.getElementById(`output-container-${mIdx}-${cKey}`);
                const statusEl = document.getElementById(`output-status-${mIdx}-${cKey}`);
                const rpmEl = document.getElementById(`output-rpm-${mIdx}-${cKey}`);
                const btnEl = document.getElementById(`output-btn-${mIdx}-${cKey}`);

                const pidEl = document.getElementById(`info-pid-${mIdx}`);
                const eidEl = document.getElementById(`info-eid-${mIdx}`);
                const midEl = document.getElementById(`info-mid-${mIdx}`);
                const cfEl = document.getElementById(`info-cf-${mIdx}`);
                const qrawEl = document.getElementById(`info-qraw-${mIdx}`);
                const qfinalEl = document.getElementById(`info-qfinal-${mIdx}`);

                if (pidEl) pidEl.innerText = machine.pid || 'N/A';
                if (eidEl) eidEl.innerText = machine.eid || 'N/A';
                if (midEl) midEl.innerText = machine.mid || 'N/A';
                if (cfEl) cfEl.innerText = machine.cf || 'N/A';
                if (qrawEl) qrawEl.innerText = `QRAW : ${machine.qraw || 0}`;
                if (qfinalEl) qfinalEl.innerText = `QFINAL : ${machine.qfinal || 0}`;

                if (container && statusEl && rpmEl && btnEl) {
                    container.style.background = isRunning ? '#d4edda' : '#f8d7da';
                    statusEl.innerText = `Trạng thái: ${isRunning ? '🟢 Đang chạy' : '🔴 Dừng'}`;
                    rpmEl.innerText = conv.rpm || 0;
                    btnEl.style.background = isRunning ? '#dc3545' : '#28a745';
                    btnEl.innerText = isRunning ? 'Tắt' : 'Bật';
                }
            });
        }
        if (machine.motors) {
            const isMotorsEnabled = machine.motors.enabled === true || parseInt(machine.motors.enabled) === 1;
            const enableBtnEl = document.getElementById(`motor-enable-btn-${mIdx}`);
            const motorListContainer = document.getElementById(`motor-list-container-${mIdx}`);
            
            if (enableBtnEl && motorListContainer) {
                enableBtnEl.style.background = isMotorsEnabled ? '#6c757d' : '#007bff';
                enableBtnEl.innerText = isMotorsEnabled ? 'Vô hiệu hóa toàn bộ Motors' : 'Kích hoạt Motors';
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
    viewStorageDashboard();
}

function openMachineControl(machine_ip) {
    if (!machine_ip || machine_ip.trim() === "") {
        alert("Máy này chưa được cấu hình địa chỉ IP!"); return;
    }
    let url = machine_ip.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'http://' + url;
    window.open(url, '_blank');
}

// ==========================================
// 7. CÁC HÀM TƯƠNG TÁC (COMMANDS)
// ==========================================
window.togglecomponent = function(machineIdx, convKey) {
    const typeObj = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machine_types[selectedTypeIndex];
    const machine = typeObj.machineUnits[machineIdx];
    const factory_id = systemData.factories[selectedFactoryIndex].id;
    const warehouse_id = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].id;
    
    const component = machine.outputs[convKey];
    component.status = parseInt(component.status) === 1 ? 0 : 1;
    fetch(`/toggleOutputState?factory_id=${factory_id}&warehouse_id=${warehouse_id}&machine_id=${machine.id}&machine_type=${typeObj.type}&output_id=${convKey}&output_state=${component.status}`)
    saveSystemData();
    updateDashboardData();
}

window.toggleMotorState = function(machineIdx, motorKey) {
    const typeObj = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machine_types[selectedTypeIndex];
    const machine = typeObj.machineUnits[machineIdx];
    const factory_id = systemData.factories[selectedFactoryIndex].id;
    const warehouse_id = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].id;
    
    const motor = machine.motors[motorKey];
    motor.state = parseInt(motor.state) === 1 ? 0 : 1;
    fetch(`/toggleMotorState?factory_id=${factory_id}&warehouse_id=${warehouse_id}&machine_id=${machine.id}&machine_type=${typeObj.type}&motor_id=${motorKey}&motor_state=${motor.state}`)
    saveSystemData();
    updateDashboardData();
}

window.toggleMotorEnable = function(machineIdx) {
    const typeObj = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machine_types[selectedTypeIndex];
    const machine = typeObj.machineUnits[machineIdx];
    if (machine.motors) {
        machine.motors.enabled = parseInt(machine.motors.enabled) === 1 ? 0 : 1;
        saveSystemData();
        viewStorageDashboard(); 
    }
}

// ==========================================
// 8. KHỞI ĐỘNG VÀ SOCKET / MQTT WEBSOCKET
// ==========================================
let mqttClient;
function initializeMQTTConnection() {
    const clientId = 'monitor-client-' + Math.random().toString(36).substring(7);
    const host = `ws://172.17.0.1:9001/mqtt`;
    mqttClient = mqtt.connect(host, {
        keepalive: 60, username: 'amt', password: 'amt123456', clientId: clientId,
        protocolId: 'MQTT', protocolVersion: 4, clean: true, reconnectPeriod: 1000
    });
    
    mqttClient.on('connect', () => {
        subscribeToDataTopics();
    });
    mqttClient.on('message', (topic, message) => {
        handleMQTTMessage(topic, message.toString());
    });
}

function generateTopicsFromData() {
    const topics = [];
    if (!systemData || !Array.isArray(systemData.factories)) return topics;
    
    systemData.factories.forEach(factory => {
        if (!Array.isArray(factory.storageUnits)) return;
        factory.storageUnits.forEach(storage => {
            if (!Array.isArray(storage.machine_types)) return;
            storage.machine_types.forEach(typeObj => {
                if (!Array.isArray(typeObj.machineUnits)) return;
                typeObj.machineUnits.forEach(machine => {
                    // Added session topic
                    topics.push(`${factory.id}/${storage.id}/${typeObj.type}/${machine.id}/session`);
                    topics.push(`${factory.id}/${storage.id}/${typeObj.type}/${machine.id}/session/data`);
                    topics.push(`${factory.id}/${storage.id}/${typeObj.type}/${machine.id}/session/info`);
                    topics.push(`${factory.id}/${storage.id}/${typeObj.type}/${machine.id}/check`);
                });
            });
        });
    });
    return topics;
}

function handleMQTTMessage(topic, message) {
    if (!systemData) return;
    try {
        console.log(`Received message from topic : ${topic}`)
        console.log(`Content : ${message}`)
        let data = message;
        if (typeof message === 'string' && message.startsWith('{')) data = JSON.parse(message);
        
        if (topic === 'supervisory') {
            systemData = data;
            updateDashboardData();
            return;
        }

        const topicParts = topic.split('/');
        const fId = topicParts[0], sId = topicParts[1], typeId = topicParts[2], mId = topicParts[3];

        // Handle the new session topic
        if (topic.endsWith('/session')) {
            updateSessionBatch(fId, sId, typeId, mId, data);
            updateDashboardData();
        }
        
        if (topic.endsWith('/motor/status')) {
            if (data && String(data["Control Mode"]) === "2") {
                updateMotorStatusBatch(fId, sId, typeId, mId, data);
                updateDashboardData(); 
            }
        }
    } catch (error) {
        console.error("Lỗi parse MQTT:", error);
    }
}

// Function to map the incoming session data to the system state
function updateSessionBatch(fId, sId, typeId, mId, data) {
    if (!systemData || !systemData.factories) return;
    const factory = systemData.factories.find(f => f.id === fId); if (!factory) return;
    const storage = factory.storageUnits.find(s => s.id === sId); if (!storage) return;
    const typeObj = (storage.machine_types || []).find(t => t.type === typeId); if (!typeObj) return;
    const machine = typeObj.machineUnits.find(m => m.id === mId); if (!machine) return;

    if (data.PID !== undefined) machine.pid = data.PID;
    // Using .trim() to clean up characters like '\n' from EID in the payload
    if (data.EID !== undefined) machine.eid = String(data.EID).trim(); 
    if (data.MID !== undefined) machine.mid = data.MID;
    if (data.cf !== undefined) machine.cf = data.cf;
    if (data.qraw !== undefined) machine.qraw = data.qraw;
    if (data.qfinal !== undefined) machine.qfinal = data.qfinal;
}
function subscribeToDataTopics() {
    if (!mqttClient) return;
    const allTopics = [...generateTopicsFromData(), 'supervisory'];
    allTopics.forEach(topic => mqttClient.subscribe(topic, { qos: 0 }));
}
function updateMotorStatusBatch(fId, sId, typeId, mId, data) {
    if (!systemData || !systemData.factories) return;
    const factory = systemData.factories.find(f => f.id === fId); if (!factory) return;
    const storage = factory.storageUnits.find(s => s.id === sId); if (!storage) return;
    const typeObj = (storage.machine_types || []).find(t => t.type === typeId); if (!typeObj) return;
    const machine = typeObj.machineUnits.find(m => m.id === mId); if (!machine) return;
    
    if (!machine.motors) machine.motors = {};
    if (data["Enabled"] !== undefined) machine.motors.enabled = parseInt(data["Enabled"]);
    if (data["Motor 1 State"] !== undefined) {
        if (!machine.motors.motor_1) machine.motors.motor_1 = { name: "Motor 1", state: 0 };
        machine.motors.motor_1.state = parseInt(data["Motor 1 State"]);
    }
    if (data["Motor 2 State"] !== undefined) {
        if (!machine.motors.motor_2) machine.motors.motor_2 = { name: "Motor 2", state: 0 };
        machine.motors.motor_2.state = parseInt(data["Motor 2 State"]);
    }
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
// 9. QUẢN LÝ THÊM / XÓA / SỬA (CRUD)
// ==========================================
function checkAdminAccess() {
    if (!currentUser || currentUser.role !== 'admin') {
        alert("Thao tác bị từ chối: Chỉ Administrator mới có quyền thực hiện!"); return false;
    }
    return true;
}

function addFactory() {
    if (!checkAdminAccess()) return;
    const name = prompt("Nhập TÊN Nhà máy:"); if (!name) return;
    const id = prompt("Nhập ID Nhà máy (Không khoảng trắng):"); if (!id) return;
    if (!systemData.factories) systemData.factories = [];
    systemData.factories.push({ id: id.trim(), name: name.trim(), storageUnits: [] });
    saveSystemData(); populateFactories();
}

function deleteFactory() {
    if (!checkAdminAccess() || selectedFactoryIndex === "") return;
    if (confirm("Xóa nhà máy này?")) {
        systemData.factories.splice(selectedFactoryIndex, 1);
        saveSystemData(); populateFactories(); loadStorages(); 
    }
}

function addStorage() {
    if (!checkAdminAccess() || selectedFactoryIndex === "") return;
    const name = prompt("Nhập TÊN Kho:"); if (!name) return;
    const id = prompt("Nhập ID Kho:"); if (!id) return;
    const factory = systemData.factories[selectedFactoryIndex];
    if (!factory.storageUnits) factory.storageUnits = [];
    factory.storageUnits.push({ id: id.trim(), name: name.trim(), machine_types: [] });
    saveSystemData(); loadStorages();
}

function deleteStorage() {
    if (!checkAdminAccess() || selectedStorageIndex === "") return;
    if (confirm("Xóa kho này?")) {
        systemData.factories[selectedFactoryIndex].storageUnits.splice(selectedStorageIndex, 1);
        saveSystemData(); loadStorages();
    }
}

// CRUD MACHINE TYPES
function addType() {
    if (!checkAdminAccess() || selectedStorageIndex === "") return;
    const typeName = prompt("Nhập loại máy (Type ID - không khoảng trắng, VD: Tank_Conveyor):");
    if (!typeName || typeName.trim() === "") return;
    
    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    if (!storage.machine_types) storage.machine_types = [];
    storage.machine_types.push({ type: typeName.trim(), machineUnits: [] });
    
    saveSystemData(); loadTypes();
}

function deleteType() {
    if (!checkAdminAccess() || selectedTypeIndex === "") return;
    if (confirm("Xóa loại máy này và tất cả máy con bên trong?")) {
        systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machine_types.splice(selectedTypeIndex, 1);
        saveSystemData(); loadTypes();
    }
}

// CRUD MACHINES
function addMachine() {
    if (!checkAdminAccess() || selectedTypeIndex === "") return;
    
    const name = prompt("Nhập TÊN Máy mới:","Machine_X"); if (!name) return;
    const id = prompt("Nhập ID Máy:","Machine_X"); if (!id) return;
    const ip = prompt("Nhập địa chỉ IP máy:", "192.168.1.100");
    const pid = prompt("Nhập PID:", "P001");
    const eid = prompt("Nhập EID:", "E001");
    const mid = prompt("Nhập MID:", "M001");
    const motor_num = parseInt(prompt("Nhập số Motor:", 4));
    const sheet_link = prompt("Nhập link Google Sheet báo cáo (nếu có):");
    const looker_link = prompt("Nhập link Looker báo cáo (nếu có):");

    let outputsObj = {};
    for (let i = 1; i <= 4; i++) outputsObj[`output_${i}`] = { name: `OUTPUT ${i}`, rpm: 0, status: 0 };
    let motorsObj = { enabled: 0 };
    for (let i = 1; i <= motor_num; i++) motorsObj[`motor_${i}`] = { name: `Motor ${i}`, state: 0 };

    const typeObj = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machine_types[selectedTypeIndex];
    if (!typeObj.machineUnits) typeObj.machineUnits = [];
    
    typeObj.machineUnits.push({
        id: id.trim(), name: name.trim(), ip: ip ? ip.trim() : "", cf: 0, qraw: 0, qfinal: 0,
        pid: pid, eid: eid, mid: mid, outputs: outputsObj, motors: motorsObj,
        sheet_link: sheet_link, looker_link: looker_link
    });
    
    saveSystemData(); loadMachines();
}

function deleteMachine() {
    if (!checkAdminAccess() || selectedMachineIndex === "") return;
    const typeObj = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machine_types[selectedTypeIndex];
    if (confirm("Xóa máy này?")) {
        typeObj.machineUnits.splice(selectedMachineIndex, 1);
        saveSystemData(); loadMachines();
    }
}

window.editMachineDetails = function(machineIdx) {
    if (!checkAdminAccess()) return;
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machine_types[selectedTypeIndex].machineUnits[machineIdx];
    
    let newName = prompt("Sửa Tên máy:", machine.name) || machine.name;
    let newId = prompt("Sửa ID máy:", machine.id) || machine.id;
    let newIp = prompt("Sửa IP máy:", machine.ip || "") || machine.ip;
    let newPid = prompt("Sửa PID:", machine.pid || "") || machine.pid;
    let newEid = prompt("Sửa EID:", machine.eid || "") || machine.eid;
    let newMid = prompt("Sửa MID:", machine.mid || "") || machine.mid;
    let newSheet = prompt("Sửa Link Gooogle Sheet:", machine.sheet_link || "") || machine.sheet_link;
    let newDashboard = prompt("Sửa Link Looker:", machine.looker_link || "") || machine.looker_link;
    
    machine.name = newName; machine.id = newId; machine.ip = newIp;
    machine.pid = newPid; machine.eid = newEid; machine.mid = newMid;
    machine.sheet_link = newSheet; machine.looker_link = newDashboard;
    
    saveSystemData(); loadMachines(); viewStorageDashboard();
}

async function openReport() {
    window.open("https://docs.google.com/spreadsheets/d/1nWi7gPbwO_FAe3IdmzI0q_OSIsJTcBx77wJ66yBZRiw/edit?gid=277851596#gid=277851596")
}