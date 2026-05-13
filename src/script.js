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
// 5. DASHBOARD KHO & MÁY (FULL RENDER)
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
        <div class="machine-block" style="border: 1px solid #ccc; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <h3>${machine.name}</h3>
            <div class="component-mini-grid" style="display:flex; gap: 15px; flex-wrap: wrap;">`;
        
        if (machine.inputs) {
            Object.entries(machine.inputs).forEach(([cKey, conv]) => {
                const isRunning = parseInt(conv.status) === 1;
                // LOGIC: Red if running, Green if stopped
                const btnColor = isRunning ? '#dc3545' : '#28a745';
                const btnText = isRunning ? 'Tắt' : 'Bật';

                html += `
                <div id="input-container-${mIdx}-${cKey}" class="conv-item" style="flex:1; min-width: 150px; border: 1px solid #ddd; padding: 10px; border-radius: 6px; background: ${isRunning ? '#d4edda' : '#f8d7da'};">
                    <strong>${conv.name || cKey}</strong>
                    <p id="input-status-${mIdx}-${cKey}">Trạng thái: ${isRunning ? '🟢 Đang chạy' : '🔴 Dừng'}</p>
                    <p>Tốc độ: <span id="input-rpm-${mIdx}-${cKey}">${conv.rpm || 0}</span> RPM</p>
                    <button id="input-btn-${mIdx}-${cKey}" style="width:100%; background:${btnColor}; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;" onclick="togglecomponent(${mIdx}, '${cKey}')">
                        ${btnText}
                    </button>
                </div>`;
            });
        }
        html += `</div></div>`;
    });
    html += `</div>`;
    detailsContent.innerHTML = html;
}

// ==========================================
// 6. SOFT UPDATE DASHBOARD (ONLY DATA)
// ==========================================
function updateDashboardData() {
    if (!systemData || selectedStorageIndex === "") return;
    
    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex];
    storage.machineUnits.forEach((machine, mIdx) => {
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
                    // Strict Data Display Logic
                    btnEl.style.background = isRunning ? '#dc3545' : '#28a745';
                    btnEl.innerText = isRunning ? 'Tắt' : 'Bật';
                }
            });
        }
    });
}

// ==========================================
// 7. CÁC HÀM TƯƠNG TÁC
// ==========================================
window.togglecomponent = function(machineIdx, convKey) {
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[machineIdx];
    const component = machine.inputs[convKey];
    
    // Command only: Prepare new state and send to server
    component.status = parseInt(component.status) === 1 ? 0 : 1;
    saveSystemData();
    
    // Note: We do NOT call updateDashboardData() here. 
    // The UI will only update when the server broadcasts the change back.
    console.log(`Command sent: Set ${convKey} to ${component.status}`);
}

// ==========================================
// 8. ĐỒNG BỘ THỜI GIAN THỰC
// ==========================================
const socket = io();
socket.on('system-data-updated', (updatedData) => {
    systemData = updatedData;
    updateDashboardData(); // Visuals update only upon receipt of data
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