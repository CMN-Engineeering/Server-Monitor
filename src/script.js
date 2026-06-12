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
// Thay thế hàm loadSystemData hiện tại trong script.js
async function loadSystemData() {
    try {
        // Fetch từ API thay vì file tĩnh
        const response = await fetch('/api/load-data');
        if (!response.ok) throw new Error('Failed to load data');
        
        systemData = await response.json();
        
        // Load lại danh sách nhà máy
        populateFactories();
        
        // Tự động load kho và máy nếu đã có dữ liệu đang chọn
        if (selectedFactoryIndex !== null && selectedFactoryIndex !== "") {
            loadStorages();
        }
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu:', error);
    }
}

// Thay thế hàm saveSystemData hiện tại trong script.js
async function saveSystemData() {
    try {
        const response = await fetch('/api/save-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(systemData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save data to server');
        }
        console.log('✅ Dữ liệu đã được lưu thành công vào sys-data.json');
        
    } catch (error) {
        console.error('❌ Lỗi khi lưu dữ liệu:', error);
        // Fallback: Lưu vào local storage nếu server lỗi
        localStorage.setItem('monitorSystemData', JSON.stringify(systemData));
    }
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
                console.log(`${mIdx}, '${cKey}'`);
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
}
function openMachineControl(machine_ip) {
    console.log("Opening control for IP:", machine_ip);
    
    // 1. Check if the IP is empty or undefined
    if (!machine_ip || machine_ip.trim() === "") {
        alert("Máy này chưa được cấu hình địa chỉ IP (IP đang trống)!");
        return;
    }

    let url = machine_ip.trim();

    // 2. Add http:// if the protocol is missing so the browser routes it externally
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
    }

    // 3. Open in a new tab/window using '_blank'
    window.open(url, '_blank');
}
// ==========================================
// 7. CÁC HÀM TƯƠNG TÁC (COMMANDS)
// ==========================================
window.togglecomponent = function(machineIdx, convKey) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    const factory_id = systemData.factories[selectedFactoryIndex].id;
    const warehouse_id = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].id;
    const machine_type = machine.type;
    const machine_id = machine.id;
    const component = machine.outputs[convKey];
    component.status = parseInt(component.status) === 1 ? 0 : 1;
    fetch(`/toggleOutputState?factory_id=${factory_id}&warehouse_id=${warehouse_id}&machine_id=${machine_id}&machine_type=${machine_type}&output_id=${convKey}&output_state=${component.status}`)
    saveSystemData();
}

window.toggleMotorState = function(machineIdx, motorKey) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    const factory_id = systemData.factories[selectedFactoryIndex].id;
    const warehouse_id = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].id;
    const machine_type = machine.type;
    const machine_id = machine.id;
    const motor = machine.motors[motorKey];
    motor.state = parseInt(motor.state) === 1 ? 0 : 1;
    fetch(`/toggleMotorState?factory_id=${factory_id}&warehouse_id=${warehouse_id}&machine_id=${machine_id}&machine_type=${machine_type}&motor_id=${motorKey}&motor_state=${motor.state}`)
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
// 8. KHỞI ĐỘNG VÀ SOCKET / MQTT WEBSOCKET
// ==========================================

// Socket.IO connection (disabled - using MQTT WebSocket instead)
// const socket = io();
// socket.on('system-data-updated', (updatedData) => {
//     systemData = updatedData;
//     updateDashboardData();
// });

// MQTT WebSocket connection for real-time data updates
let mqttClient;

function initializeMQTTConnection() {
    const clientId = 'monitor-client-' + Math.random().toString(36).substring(7);
    const currentHost = window.location.hostname;
    const host = `ws://${currentHost}:9001/mqtt`;
    
    const options = {
        keepalive: 60,
        username: 'amt',
        password: 'amt123456',
        clientId: clientId,
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
    };
    
    mqttClient = mqtt.connect(host, options);
    
    mqttClient.on('error', (err) => {
        console.error('MQTT Error:', err);
    });
    
    mqttClient.on('reconnect', () => {
        console.log('MQTT Reconnecting...');
    });
    
    mqttClient.on('connect', () => {
        console.log('MQTT Connected:', clientId);
        // Subscribe to system data topics
        subscribeToDataTopics();
    });
    
    // Handle incoming messages
    mqttClient.on('message', (topic, message) => {
        try {
            const messageStr = message.toString();
            console.log('MQTT Message from ' + topic + ':', messageStr);
            handleMQTTMessage(topic, messageStr);
        } catch (error) {
            console.error('Error processing MQTT message:', error);
        }
    });
}

function generateTopicsFromData() {
    const topics = [];
    
    // Kiểm tra xem systemData.factories có tồn tại và là một mảng không
    if (!systemData || !Array.isArray(systemData.factories)) return topics;
    
    // Duyệt qua mảng các nhà máy
    systemData.factories.forEach(factory => {
        if (!Array.isArray(factory.storageUnits)) return;
        
        // Duyệt qua mảng các kho trong nhà máy
        factory.storageUnits.forEach(storage => {
            if (!Array.isArray(storage.machineUnits)) return;
            
            // Duyệt qua mảng các máy trong kho
            storage.machineUnits.forEach(machine => {
                // Đảm bảo machine type có giá trị, nếu trống thì để mặc định tránh lỗi undefined trên topic
                const machineType = machine.type || "unknown_type";
                
                // Generate motor topics
                topics.push(`${factory.id}/${storage.id}/${machineType}/${machine.id}/motor/status`);
                
                // Nếu sau này bạn cần subscribe riêng cho output, bạn có thể duyệt qua object machine.outputs:
                // if (machine.outputs) {
                //     Object.keys(machine.outputs).forEach(outputId => {
                //         topics.push(`${factory.id}/${storage.id}/${machineType}/${machine.id}/${outputId}/status`);
                //     });
                // }
            });
        });
    });
    
    return topics;
}
function subscribeToDataTopics() {
    if (!mqttClient) return;
    
    // Generate topics from system data
    const generatedTopics = generateTopicsFromData();
    for(let topic of generatedTopics) {
        console.log('Generated topic to subscribe:', topic);
    }
    
    // Add wildcard topics for flexibility
    const staticTopics = [
        'supervisory'
    ];
    
    const allTopics = [...generatedTopics, ...staticTopics];
    
    allTopics.forEach(topic => {
        mqttClient.subscribe(topic, { qos: 0 }, (err) => {
            if (!err) {
                console.log('Subscribed to topic:', topic);
            } else {
                console.error('Subscription error for topic ' + topic + ':', err);
            }
        });
    });
    
    console.log('Total subscribed topics:', allTopics.length);
}

function handleMQTTMessage(topic, message) {
    if (!systemData) return;
    
    try {
        // Try parsing as JSON first
        let data = message;
        if (typeof message === 'string' && message.startsWith('{')) {
            data = JSON.parse(message);
        }
        if (topic === 'supervisory') {
            systemData = data;
            updateDashboardData();
            return;
        }
        // Parse topic and update corresponding data
        const topicParts = topic.split('/');
        
        // Handle output status updates: factory/{id}/storage/{id}/machine/{id}/output/{id}/status
        if (topic.includes('/motor/status')) {
            const factoryId = topicParts[0];
            const storageId = topicParts[1];
            const machineId = topicParts[3];
            
            if (data && String(data["Control Mode"]) === "2") {
                updateMotorStatusBatch(factoryId, storageId, machineId, data);
                updateDashboardData(); // Cập nhật lại UI ngay lập tức
                return; // Ngừng xử lý các logic bên dưới
            }
        }
                
        updateDashboardData();
    } catch (error) {
        console.error('Error handling MQTT message:', error);
    }
}

function updateMotorStatusBatch(factoryId, storageId, machineId, data) {
    if (!systemData || !systemData.factories) return;
    
    // Tìm Factory
    const factory = systemData.factories.find(f => f.id === factoryId);
    if (!factory) return;
    
    // Tìm Kho
    const storage = factory.storageUnits.find(s => s.id === storageId);
    if (!storage) return;
    
    // Tìm Máy
    const machine = storage.machineUnits.find(m => m.id === machineId);
    if (!machine) return;
    
    // Khởi tạo object motors nếu chưa có
    if (!machine.motors) machine.motors = {};
    
    // 1. Cập nhật trạng thái "Enabled" (Kích hoạt / Vô hiệu hóa toàn bộ)
    if (data["Enabled"] !== undefined) {
        machine.motors.enabled = parseInt(data["Enabled"]);
    }
    
    // 2. Cập nhật trạng thái Motor 1
    if (data["Motor 1 State"] !== undefined) {
        if (!machine.motors.motor_1) machine.motors.motor_1 = { name: "Motor 1", state: 0 };
        machine.motors.motor_1.state = parseInt(data["Motor 1 State"]);
    }
    
    // 3. Cập nhật trạng thái Motor 2
    if (data["Motor 2 State"] !== undefined) {
        if (!machine.motors.motor_2) machine.motors.motor_2 = { name: "Motor 2", state: 0 };
        machine.motors.motor_2.state = parseInt(data["Motor 2 State"]);
    }
    
    console.log(`✅ Đã cập nhật UI trực tiếp cho ${machineId} từ Broker!`);
}

function updateOutputData(factoryId, storageId, machineId, outputId, data) {
    if (!systemData || !systemData.factories) return;
    
    const factory = systemData.factories.find(f => f.id === factoryId);
    if (!factory) return;
    
    const storage = factory.storageUnits.find(s => s.id === storageId);
    if (!storage) return;
    
    const machine = storage.machineUnits.find(m => m.id === machineId);
    if (!machine || !machine.outputs) return;
    
    const output = machine.outputs[outputId];
    if (output) {
        if (typeof data === 'object') {
            Object.assign(output, data);
        } else {
            output.status = parseInt(data);
        }
    }
}

function updateMotorData(factoryId, storageId, machineId, motorId, data) {
    if (!systemData || !systemData.factories) return;
    
    const factory = systemData.factories.find(f => f.id === factoryId);
    if (!factory) return;
    
    const storage = factory.storageUnits.find(s => s.id === storageId);
    if (!storage) return;
    
    const machine = storage.machineUnits.find(m => m.id === machineId);
    if (!machine || !machine.motors) return;
    
    const motor = machine.motors[motorId];
    if (motor) {
        if (typeof data === 'object') {
            Object.assign(motor, data);
        } else {
            motor.state = parseInt(data);
        }
    }
}

function updateMachineAllData(machineData) {
    if (!systemData || !systemData.factories) return;
    
    // Find and update machine data by comparing IDs
    for (let factory of systemData.factories) {
        for (let storage of factory.storageUnits) {
            for (let i = 0; i < storage.machineUnits.length; i++) {
                if (storage.machineUnits[i].id === machineData.id) {
                    // Update outputs
                    if (machineData.outputs) {
                        Object.assign(storage.machineUnits[i].outputs, machineData.outputs);
                    }
                    // Update motors
                    if (machineData.motors) {
                        Object.assign(storage.machineUnits[i].motors, machineData.motors);
                    }
                    return;
                }
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedSession = localStorage.getItem('monitorSession');
    if (savedSession) {
        currentUser = JSON.parse(savedSession);
        startApp();
        // Initialize MQTT connection after app starts
        setTimeout(() => {
            initializeMQTTConnection();
        }, 500);
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

    const numOutputsStr = prompt("Nhập số lượng Outputs cho máy này (VD: 4):", "4");
    const numOutputs = parseInt(numOutputsStr) || 0;

    const numMotorsStr = prompt("Nhập số lượng Motors cho máy này (VD: 2):", "2");
    const numMotors = parseInt(numMotorsStr) || 0;

    let outputsObj = {};
    for (let i = 1; i <= numOutputs; i++) {
        outputsObj[`output_${i}`] = {
            name: `OUTPUT ${i}`,
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
        outputs: outputsObj,
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

function detectDevTool(logDiff) {
    const data = Array.from({ length: 5000 }, (_, i) => ({
        index: i,
        value: Math.random()
    }));

    const start1 = performance.now();
    console
    const logTime = performance.now() - start1;

    const start2 = performance.now();
    console.table(data);
    const tableTime = performance.now() - start2;

    console.clear();

    if (tableTime - logTime > logDiff) {
        return true;
    }

    return false;
}

let isOpen = false;

function lockDevTool() {
    if (detectDevTool(20)) {
        if (!isOpen) {
            isOpen = true;
            logout(1);
            // Redirect browser
            window.location.href = "/none.html";
        }
    } else {
        isOpen = false;
    }
}

// setInterval(lockDevTool, 200);
// =========================================
// XUẤT BÁO CÁO RA EXCEL
// =========================================
// =========================================
// XUẤT BÁO CÁO RA EXCEL (SỬ DỤNG EXCELJS)
// =========================================

async function downloadReport() {
    // 1. Lấy trực tiếp index từ thẻ Select trên giao diện để tránh sai lệch dữ liệu
    const factorySelectDOM = document.getElementById('factory-select');
    const storageSelectDOM = document.getElementById('storage-select');
    
    const fVal = factorySelectDOM ? factorySelectDOM.value : "";
    const sVal = storageSelectDOM ? storageSelectDOM.value : "";

    if (fVal === "" || sVal === "") {
        alert("Vui lòng chọn Nhà máy và Kho trước khi tải báo cáo!");
        return;
    }

    try {
        // Chuyển string value sang kiểu số nguyên (Integer)
        const fIndex = parseInt(fVal, 10);
        const sIndex = parseInt(sVal, 10);

        // --- Bắt đầu phần kiểm tra an toàn (Safe Checks) ---
        if (!systemData || !systemData.factories) {
            throw new Error("Dữ liệu hệ thống chưa sẵn sàng.");
        }

        const selectedFactory = systemData.factories[fIndex];
        if (!selectedFactory) {
            throw new Error(`Không tìm thấy dữ liệu nhà máy tại vị trí ${fIndex}`);
        }

        const selectedStorage = selectedFactory.storageUnits[sIndex];
        if (!selectedStorage) {
            throw new Error(`Không tìm thấy dữ liệu kho tại vị trí ${sIndex}`);
        }
        // --- Kết thúc kiểm tra an toàn ---
        const factory_name = selectedFactory.name;
        const warehouse_name = selectedStorage.name;
        
        const machines = selectedStorage.machineUnits || [];

        if (machines.length === 0) {
            alert("Không có máy nào trong kho được chọn!");
            return;
        }

        // 2. Fetch file mẫu từ server (format.xlsx)
        const response = await fetch('format.xlsx');
        if (!response.ok) {
            throw new Error("Không thể tải file định dạng (format.xlsx). Hãy đảm bảo file này nằm đúng thư mục.");
        }
        const reporter_name = prompt("Nhập tên người tạo báo cáo:","Nguyen Van A");
        if (!reporter_name || reporter_name.trim() === "") return;
        const production_code = prompt("Mã lệnh sản xuất:","PD-111222333");
        if (!production_code || production_code.trim() === "") return;


        const arrayBuffer = await response.arrayBuffer();
        const today = new Intl.DateTimeFormat(["ban", "id"]).format(new Date());
        const month = today.split("/")[1];
        const year = today.split("/")[2];
        // 3. Khởi tạo Workbook của ExcelJS và load dữ liệu mẫu
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        // Lấy worksheet đầu tiên (Sheet1)
        const worksheet = workbook.getWorksheet(1); 
        const factory_storage_cell = worksheet.getRow(4).getCell(3);
        const reporter_name_cell = worksheet.getRow(6).getCell(3);
        const report_period_cell = worksheet.getRow(5).getCell(3);
        const production_code_cell = worksheet.getRow(5).getCell(6);
        const report_time_cell = worksheet.getRow(4).getCell(6);
        
        factory_storage_cell.value = `${factory_name} - ${warehouse_name}`;
        reporter_name_cell.value = reporter_name;
        report_period_cell.value = `${month}/${year}`;
        production_code_cell.value = production_code;
        report_time_cell.value = (new Date()).toLocaleString();
        
        // 4. Ghi danh sách máy móc (Bắt đầu từ dòng 9)
        let startRow = 9;

        machines.forEach((machine, index) => {
            const row = worksheet.getRow(startRow + index);
            
            // Cột 1 (A): STT
            row.getCell(1).value = index + 1; 
            row.getCell(2).value = machine.name || machine.id || `Máy ${index + 1}`; 
            row.getCell(3).value = today; 
            row.getCell(4).value = 5000; 
            row.getCell(5).value = 5000; 
            row.getCell(6).value = 50; 
            row.commit(); 
        });

        // 5. Chuyển đổi thành Buffer và tải file xuống
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Tạo link ảo để download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Tên file linh động theo nhà máy và kho
        a.download = `Bao_Cao_${selectedFactory.name}_${selectedStorage.name}.xlsx`.replace(/\s+/g, '_');
        
        document.body.appendChild(a);
        a.click(); 
        
        // Dọn dẹp
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Lỗi xuất báo cáo:", error);
        alert("Đã xảy ra lỗi trong quá trình tạo báo cáo:\n" + error.message);
    }
}