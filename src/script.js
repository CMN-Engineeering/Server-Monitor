// ==========================================
// 1. KHỞI TẠO BIẾN VÀ CẤU TRÚC DỮ LIỆU
// ==========================================
let systemData = null;
let selectedFactoryIndex = null;
let selectedStorageIndex = null;
let selectedMachineIndex = null;
let selectedConveyorIndex = null;

const factorySelect = document.getElementById('factory-select');
const storageSelect = document.getElementById('storage-select');
const machineSelect = document.getElementById('machine-select');
const conveyorSelect = document.getElementById('conveyor-select');
const detailsPanel = document.getElementById('details-panel');
const detailsTitle = document.getElementById('details-title');
const detailsContent = document.getElementById('details-content');

// ==========================================
// 2. TẢI DỮ LIỆU TỪ JSON FILE
// ==========================================
async function loadSystemData() {
    try {
        const response = await fetch('http://localhost:3000/api/load-data');
        if (!response.ok) {
            throw new Error('Failed to load data from server');
        }
        systemData = await response.json();
        console.log('✅ Dữ liệu đã tải từ server:', systemData);
        populateFactories();
    } catch (error) {
        console.error('❌ Lỗi khi tải dữ liệu:', error);
        // Fallback: Try loading from file directly
        try {
            const response = await fetch('sys-data.json');
            systemData = await response.json();
            console.log('✅ Dữ liệu đã tải từ file:', systemData);
            populateFactories();
        } catch (fileError) {
            console.error('❌ Không thể tải dữ liệu:', fileError);
            alert('Lỗi: Không thể tải dữ liệu. Hãy chắc chắn rằng sys-data.json tồn tại hoặc server đang chạy');
        }
    }
}

// ==========================================
// 3. LƯỚI FACTORY (NHÀ MÁY)
// ==========================================
function populateFactories() {
    factorySelect.innerHTML = '<option value="">-- Chọn nhà máy --</option>';
    
    if (systemData && systemData.factories) {
        systemData.factories.forEach((factory, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = factory.id;
            factorySelect.appendChild(option);
        });
    }
}

function addFactory() {
    const factoryName = prompt("Nhập tên nhà máy mới:");
    if (!factoryName || factoryName.trim() === "") return;
    
    const newFactory = {
        id: factoryName.trim(),
        storageUnits: []
    };
    
    systemData.factories.push(newFactory);
    saveSystemData();
    populateFactories();
    
    // Tự động chọn nhà máy vừa tạo
    selectedFactoryIndex = systemData.factories.length - 1;
    factorySelect.value = selectedFactoryIndex;
    loadStorages(); // Load danh sách kho (đang trống) cho nhà máy mới
    
    alert(`Đã thêm nhà máy: ${factoryName}`);
    
    // Gợi ý thêm cấp thấp hơn
    if (confirm(`Bạn có muốn thêm Kho (Storage) cho nhà máy [${factoryName}] ngay bây giờ không?`)) {
        addStorage();
    }
}

function deleteFactory() {
    const selectedIndex = factorySelect.value;
    
    if (selectedIndex === "") {
        alert("Vui lòng chọn nhà máy để xóa!");
        return;
    }
    
    const factory = systemData.factories[selectedIndex];
    if (confirm(`Bạn có chắc muốn xóa [${factory.id}] và toàn bộ nội dung không?`)) {
        systemData.factories.splice(selectedIndex, 1);
        saveSystemData();
        populateFactories();
        clearAllSelections();
        alert("Đã xóa nhà máy!");
    }
}

// ==========================================
// 4. LƯỚI STORAGE (KHO)
// ==========================================
function loadStorages() {
    storageSelect.innerHTML = '<option value="">-- Chọn kho --</option>';
    machineSelect.innerHTML = '<option value="">-- Chọn máy --</option>';
    conveyorSelect.innerHTML = '<option value="">-- Chọn băng tải --</option>';
    detailsPanel.innerHTML = '<h2>Chọn một bánh xe tải để xem chi tiết</h2>';
    
    selectedFactoryIndex = factorySelect.value;
    
    if (selectedFactoryIndex === "") return;
    
    const factory = systemData.factories[selectedFactoryIndex];
    if (factory && factory.storageUnits) {
        factory.storageUnits.forEach((storage, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = storage.name;
            storageSelect.appendChild(option);
        });
    }
}

function addStorage() {
    if (selectedFactoryIndex === null || selectedFactoryIndex === "") {
        alert("Vui lòng chọn nhà máy trước!");
        return;
    }
    
    const storageName = prompt("Nhập tên kho:");
    if (!storageName || storageName.trim() === "") return;
    
    const newStorage = {
        id: `storage_${Date.now()}`,
        name: storageName.trim(),
        machineUnits: []
    };
    
    systemData.factories[selectedFactoryIndex].storageUnits.push(newStorage);
    saveSystemData();
    loadStorages();
    
    // Tự động chọn kho vừa tạo
    selectedStorageIndex = systemData.factories[selectedFactoryIndex].storageUnits.length - 1;
    storageSelect.value = selectedStorageIndex;
    loadMachines();
    
    alert(`Đã thêm kho: ${storageName}`);
    
    // Gợi ý thêm cấp thấp hơn
    if (confirm(`Bạn có muốn thêm Máy (Machine) cho kho [${storageName}] ngay bây giờ không?`)) {
        addMachine();
    }
}

function deleteStorage() {
    if (selectedFactoryIndex === null || selectedFactoryIndex === "") {
        alert("Vui lòng chọn nhà máy!");
        return;
    }
    
    const selectedIndex = storageSelect.value;
    if (selectedIndex === "") {
        alert("Vui lòng chọn kho để xóa!");
        return;
    }
    
    const storage = systemData.factories[selectedFactoryIndex].storageUnits[selectedIndex];
    if (confirm(`Bạn có chắc muốn xóa [${storage.name}] không?`)) {
        systemData.factories[selectedFactoryIndex].storageUnits.splice(selectedIndex, 1);
        saveSystemData();
        loadStorages();
        alert("Đã xóa kho!");
    }
}

// ==========================================
// 5. LƯỚI MACHINE (MÁY)
// ==========================================
function loadMachines() {
    machineSelect.innerHTML = '<option value="">-- Chọn máy --</option>';
    conveyorSelect.innerHTML = '<option value="">-- Chọn băng tải --</option>';
    detailsPanel.innerHTML = '<h2>Chọn một bánh xe tải để xem chi tiết</h2>';
    
    selectedStorageIndex = storageSelect.value;
    
    if (selectedStorageIndex === "") return;
    
    const factory = systemData.factories[selectedFactoryIndex];
    const storage = factory.storageUnits[selectedStorageIndex];
    
    if (storage && storage.machineUnits) {
        storage.machineUnits.forEach((machine, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = machine.name;
            machineSelect.appendChild(option);
        });
    }
}
function addMachine() {
    if (selectedStorageIndex === null || selectedStorageIndex === "") {
        alert("Vui lòng chọn kho trước!");
        return;
    }
    
    const machineName = prompt("Nhập tên máy:");
    if (!machineName || machineName.trim() === "") return;
    
    const newMachine = {
        id: `machine_${Date.now()}`,
        name: machineName.trim(),
        conveyors: []
    };
    
    systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits.push(newMachine);
    saveSystemData();
    loadMachines();
    
    // Tự động chọn máy vừa tạo
    selectedMachineIndex = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits.length - 1;
    machineSelect.value = selectedMachineIndex;
    loadConveyors();
    
    alert(`Đã thêm máy: ${machineName}`);
    
    // Gợi ý thêm cấp thấp hơn
    if (confirm(`Bạn có muốn thêm Băng tải (Conveyor) cho máy [${machineName}] ngay bây giờ không?`)) {
        addConveyor();
    }
}

function deleteMachine() {
    if (selectedStorageIndex === null || selectedStorageIndex === "") {
        alert("Vui lòng chọn kho!");
        return;
    }
    
    const selectedIndex = machineSelect.value;
    if (selectedIndex === "") {
        alert("Vui lòng chọn máy để xóa!");
        return;
    }
    
    const machine = systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits[selectedIndex];
    if (confirm(`Bạn có chắc muốn xóa [${machine.name}] không?`)) {
        systemData.factories[selectedFactoryIndex].storageUnits[selectedStorageIndex].machineUnits.splice(selectedIndex, 1);
        saveSystemData();
        loadMachines();
        alert("Đã xóa máy!");
    }
}

// ==========================================
// 6. LƯỚI CONVEYOR (BĂNG TẢI)
// ==========================================
function loadConveyors() {
    conveyorSelect.innerHTML = '<option value="">-- Chọn băng tải --</option>';
    detailsPanel.innerHTML = '<h2>Chọn một bánh xe tải để xem chi tiết</h2>';
    
    selectedMachineIndex = machineSelect.value;
    
    if (selectedMachineIndex === "") return;
    
    const factory = systemData.factories[selectedFactoryIndex];
    const storage = factory.storageUnits[selectedStorageIndex];
    const machine = storage.machineUnits[selectedMachineIndex];
    
    if (machine && machine.conveyors) {
        machine.conveyors.forEach((conveyor, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = conveyor.name;
            conveyorSelect.appendChild(option);
        });
    }
}
function addConveyor() {
    if (selectedMachineIndex === null || selectedMachineIndex === "") {
        alert("Vui lòng chọn máy trước!");
        return;
    }
    
    const conveyorName = prompt("Nhập tên băng tải:");
    if (!conveyorName || conveyorName.trim() === "") return;
    
    const newConveyor = {
        id: `conveyor_${Date.now()}`,
        name: conveyorName.trim(),
        status: "stopped",
        speed: 0
    };
    
    const factory = systemData.factories[selectedFactoryIndex];
    const storage = factory.storageUnits[selectedStorageIndex];
    const machine = storage.machineUnits[selectedMachineIndex];
    
    machine.conveyors.push(newConveyor);
    saveSystemData();
    loadConveyors();
    
    // Tự động chọn băng tải vừa tạo
    selectedConveyorIndex = machine.conveyors.length - 1;
    conveyorSelect.value = selectedConveyorIndex;
    loadConveyorDetails(); // Hiển thị dashboard/chi tiết ngay lập tức
    
    alert(`Đã thêm băng tải: ${conveyorName}`);
}

function deleteConveyor() {
    if (selectedMachineIndex === null || selectedMachineIndex === "") {
        alert("Vui lòng chọn máy!");
        return;
    }
    
    const selectedIndex = conveyorSelect.value;
    if (selectedIndex === "") {
        alert("Vui lòng chọn băng tải để xóa!");
        return;
    }
    
    const factory = systemData.factories[selectedFactoryIndex];
    const storage = factory.storageUnits[selectedStorageIndex];
    const machine = storage.machineUnits[selectedMachineIndex];
    const conveyor = machine.conveyors[selectedIndex];
    
    if (confirm(`Bạn có chắc muốn xóa [${conveyor.name}] không?`)) {
        machine.conveyors.splice(selectedIndex, 1);
        saveSystemData();
        loadConveyors();
        alert("Đã xóa băng tải!");
    }
}

// ==========================================
// 7. HIỂN THỊ CHI TIẾT CONVEYOR
// ==========================================
function loadConveyorDetails() {
    const selectedIndex = conveyorSelect.value;
    
    if (selectedIndex === "") {
        detailsPanel.innerHTML = '<h2>Chọn một bánh xe tải để xem chi tiết</h2>';
        return;
    }
    
    const factory = systemData.factories[selectedFactoryIndex];
    const storage = factory.storageUnits[selectedStorageIndex];
    const machine = storage.machineUnits[selectedMachineIndex];
    const conveyor = machine.conveyors[selectedIndex];
    
    detailsTitle.innerText = `Chi tiết: ${conveyor.name}`;
    detailsContent.innerHTML = `
        <div class="detail-info">
            <p><strong>Tên:</strong> ${conveyor.name}</p>
            <p><strong>Trạng thái:</strong> <span class="status-${conveyor.status}">${conveyor.status === 'running' ? '🟢 Đang chạy' : '🔴 Dừng'}</span></p>
            <p><strong>Tốc độ:</strong> ${conveyor.speed} RPM</p>
            <p><strong>ID:</strong> ${conveyor.id}</p>
        </div>
    `;
}

// ==========================================
// 8. DASHBOARD THEO MỨC ĐỘ XEM
// ==========================================
function viewStorageDashboard() {
    if (selectedStorageIndex === null || selectedStorageIndex === "") {
        alert("Vui lòng chọn một kho để xem!");
        return;
    }
    
    const factory = systemData.factories[selectedFactoryIndex];
    const storage = factory.storageUnits[selectedStorageIndex];
    
    detailsTitle.innerText = `Dashboard Kho: ${storage.name}`;
    
    let dashboardHTML = '<div class="dashboard">';
    
    if (storage.machineUnits && storage.machineUnits.length > 0) {
        dashboardHTML += '<h3>Danh sách máy và trạng thái băng tải</h3>';
        
        storage.machineUnits.forEach((machine, machineIdx) => {
            dashboardHTML += `
                <div class="dashboard-section">
                    <h4>🤖 ${machine.name} (${machine.conveyors ? machine.conveyors.length : 0} băng tải)</h4>
                    <div class="conveyor-list">
            `;
            
            if (machine.conveyors && machine.conveyors.length > 0) {
                machine.conveyors.forEach(conveyor => {
                    const statusIcon = conveyor.status === 'running' ? '🟢' : '🔴';
                    const statusText = conveyor.status === 'running' ? 'Đang chạy' : 'Dừng';
                    dashboardHTML += `
                        <div class="conveyor-item">
                            <span class="conveyor-name">${conveyor.name}</span>
                            <span class="conveyor-status">${statusIcon} ${statusText}</span>
                            <span class="conveyor-speed">Tốc độ: ${conveyor.speed}</span>
                        </div>
                    `;
                });
            } else {
                dashboardHTML += '<p class="no-data">Chưa có băng tải</p>';
            }
            
            dashboardHTML += '</div></div>';
        });
    } else {
        dashboardHTML += '<p class="no-data">Chưa có máy nào trong kho này</p>';
    }
    
    dashboardHTML += '</div>';
    detailsContent.innerHTML = dashboardHTML;
}

function viewMachineDashboard() {
    if (selectedMachineIndex === null || selectedMachineIndex === "") {
        alert("Vui lòng chọn một máy để xem!");
        return;
    }
    
    const factory = systemData.factories[selectedFactoryIndex];
    const storage = factory.storageUnits[selectedStorageIndex];
    const machine = storage.machineUnits[selectedMachineIndex];
    
    detailsTitle.innerText = `Dashboard Máy: ${machine.name}`;
    
    let dashboardHTML = '<div class="dashboard">';
    dashboardHTML += '<h3>Danh sách băng tải và trạng thái</h3>';
    dashboardHTML += '<div class="conveyor-grid">';
    
    if (machine.conveyors && machine.conveyors.length > 0) {
        machine.conveyors.forEach(conveyor => {
            const statusIcon = conveyor.status === 'running' ? '🟢' : '🔴';
            const statusText = conveyor.status === 'running' ? 'Đang chạy' : 'Dừng';
            const statusClass = conveyor.status === 'running' ? 'running' : 'stopped';
            
            dashboardHTML += `
                <div class="conveyor-card ${statusClass}">
                    <div class="card-header">${conveyor.name}</div>
                    <div class="card-body">
                        <div class="card-row">
                            <span class="label">Trạng thái:</span>
                            <span class="value">${statusIcon} ${statusText}</span>
                        </div>
                        <div class="card-row">
                            <span class="label">Tốc độ:</span>
                            <span class="value">${conveyor.speed} RPM</span>
                        </div>
                        <div class="card-row">
                            <span class="label">ID:</span>
                            <span class="value">${conveyor.id}</span>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        dashboardHTML += '<p class="no-data">Chưa có băng tải nào</p>';
    }
    
    dashboardHTML += '</div></div>';
    detailsContent.innerHTML = dashboardHTML;
}

function viewConveyorDashboard() {
    if (selectedConveyorIndex === null || conveyorSelect.value === "") {
        alert("Vui lòng chọn một băng tải để xem!");
        return;
    }
    
    const selectedIndex = conveyorSelect.value;
    const factory = systemData.factories[selectedFactoryIndex];
    const storage = factory.storageUnits[selectedStorageIndex];
    const machine = storage.machineUnits[selectedMachineIndex];
    const conveyor = machine.conveyors[selectedIndex];
    
    detailsTitle.innerText = `Dashboard Băng tải: ${conveyor.name}`;
    
    const statusIcon = conveyor.status === 'running' ? '🟢' : '🔴';
    const statusText = conveyor.status === 'running' ? 'Đang chạy' : 'Dừng';
    
    let dashboardHTML = `
        <div class="dashboard">
            <div class="conveyor-detail-large">
                <div class="status-display ${conveyor.status}">
                    <div class="status-icon">${statusIcon}</div>
                    <div class="status-text">${statusText}</div>
                </div>
                
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Tên</div>
                        <div class="detail-value">${conveyor.name}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">ID</div>
                        <div class="detail-value">${conveyor.id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Tốc độ</div>
                        <div class="detail-value">${conveyor.speed} RPM</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Trạng thái</div>
                        <div class="detail-value">${statusText}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    detailsContent.innerHTML = dashboardHTML;
}

// ==========================================
// 9. HỖ TRỢ HÀM
// ==========================================
function clearAllSelections() {
    selectedFactoryIndex = null;
    selectedStorageIndex = null;
    selectedMachineIndex = null;
    selectedConveyorIndex = null;
    
    storageSelect.innerHTML = '<option value="">-- Chọn kho --</option>';
    machineSelect.innerHTML = '<option value="">-- Chọn máy --</option>';
    conveyorSelect.innerHTML = '<option value="">-- Chọn băng tải --</option>';
    detailsPanel.innerHTML = '<h2>Chọn một bánh xe tải để xem chi tiết</h2>';
}

function saveSystemData() {
    console.log('Lưu dữ liệu:', systemData);
    
    // Gửi dữ liệu tới backend để lưu file
    fetch('http://localhost:3000/api/save-data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(systemData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('✅ Response from server:', data);
        if (data.success) {
            console.log('✅ Dữ liệu đã được lưu vào sys-data.json');
        }
    })
    .catch(error => {
        console.error('❌ Lỗi khi lưu dữ liệu:', error);
        console.warn('⚠️ Hãy đảm bảo server đang chạy: node server.js');
    });
}

function exportData() {
    const dataStr = JSON.stringify(systemData, null, 4);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sys-data.json';
    a.click();
    URL.revokeObjectURL(url);
}

// ==========================================
// 10. KHỞI ĐỘNG TRANG
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadSystemData();
});