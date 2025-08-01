// Enhanced Dashboard JavaScript with Real District Selection and PDF Reports
console.log("Loading MLS Dashboard...");

// Global variables
let dashboardData = {
  points: [],
  districts: [],
  mandals: [],
  stats: {},
  charts: {},
  selectedDistrict: null,
  selectedDistrictCode: null
};

let currentPage = 1;
let itemsPerPage = 25;
let filteredData = [];

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded, initializing dashboard...");
  initializeDashboard();
});

// Main initialization function
async function initializeDashboard() {
  try {
    showLoadingState();

    // Load user info
    await loadUserInfo();

    // Load available districts first
    await loadAvailableDistricts();

    // Load initial dashboard data (all districts)
    await loadDashboardData();

    // Setup charts (with fallback)
    setupChartsWithFallback();

    // Show dashboard content
    showDashboardContent();

    // Setup event listeners
    setupEventListeners();

    // Update activity
    updateRecentActivity("Dashboard initialized", "Dashboard loaded successfully with all districts data");

    console.log("Dashboard initialized successfully");
    showToast("Dashboard loaded successfully", "success");

  } catch (error) {
    console.error("Dashboard initialization failed:", error);
    showErrorState(error.message);
  }
}

// Load user information
async function loadUserInfo() {
  try {
    const response = await fetch("/api/user");
    if (response.ok) {
      const userData = await response.json();
      document.getElementById("currentUser").textContent = userData.user || "JPKrishna28";
    }
  } catch (error) {
    console.warn("Failed to load user info:", error);
    document.getElementById("currentUser").textContent = "JPKrishna28";
  }
}

// Load available districts for selection
async function loadAvailableDistricts() {
  try {
    console.log("Loading available districts...");
    const response = await fetch("/api/districts");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const districts = await response.json();
    console.log("Available districts:", districts);

    dashboardData.districts = districts;
    populateDistrictSelector();

  } catch (error) {
    console.error("Failed to load districts:", error);
    showToast("Failed to load districts list", "warning");
  }
}

// Populate district selector
function populateDistrictSelector() {
  const select = document.getElementById('dashboardDistrict');
  if (!select) return;

  select.innerHTML = '<option value="">All Districts</option>';

  dashboardData.districts.forEach(district => {
    const option = document.createElement('option');

    if (typeof district === 'string') {
      option.value = district;
      option.textContent = district;
    } else if (district["District Code"] && district["District Name"]) {
      option.value = district["District Code"];
      option.textContent = district["District Name"];
    } else if (district.code && district.name) {
      option.value = district.code;
      option.textContent = district.name;
    }

    select.appendChild(option);
  });
}

// Load dashboard data based on selected district
async function loadDashboardData() {
  try {
    console.log("Loading dashboard data...");

    const selectedDistrictCode = dashboardData.selectedDistrictCode;

    if (selectedDistrictCode) {
      // Load data for specific district
      await loadDistrictSpecificData(selectedDistrictCode);
    } else {
      // Load data for all districts
      await loadAllDistrictsData();
    }

    // Calculate and update stats
    calculateStats();
    updateStatsDisplay();
    updateTable();
    updateSelectionInfo();

  } catch (error) {
    console.error("Failed to load dashboard data:", error);
    showToast("Failed to load dashboard data", "error");
  }
}

// Load data for specific district
async function loadDistrictSpecificData(districtCode) {
  try {
    console.log("Loading data for district:", districtCode);

    // First load mandals for this district
    const mandalsResponse = await fetch(`/api/mandals/${encodeURIComponent(districtCode)}`);
    if (mandalsResponse.ok) {
      dashboardData.mandals = await mandalsResponse.json();
      console.log("Loaded mandals:", dashboardData.mandals);
    }

    // Load MLS points for each mandal in this district
    const allPoints = [];

    for (const mandal of dashboardData.mandals) {
      try {
        let mandalCode;
        if (typeof mandal === 'string') {
          mandalCode = mandal;
        } else if (mandal["Mandal Code"]) {
          mandalCode = mandal["Mandal Code"];
        } else if (mandal.code) {
          mandalCode = mandal.code;
        }

        if (mandalCode) {
          console.log(`Loading points for ${districtCode}/${mandalCode}`);
          const pointsResponse = await fetch(`/api/mls_points/${encodeURIComponent(districtCode)}/${encodeURIComponent(mandalCode)}`);

          if (pointsResponse.ok) {
            const points = await pointsResponse.json();
            allPoints.push(...points);
            console.log(`Loaded ${points.length} points for ${mandalCode}`);
          }
        }

        // Small delay to prevent overwhelming server
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.warn(`Failed to load points for mandal:`, error);
      }
    }

    dashboardData.points = allPoints;
    filteredData = [...allPoints];

    console.log(`Total points loaded for district: ${allPoints.length}`);

    // Update activity
    const districtName = getDistrictName(districtCode);
    updateRecentActivity("District Selected", `Loaded ${allPoints.length} MLS points for ${districtName} district`);

  } catch (error) {
    console.error("Failed to load district specific data:", error);
    throw error;
  }
}

// Load data for all districts (sample)
async function loadAllDistrictsData() {
  try {
    console.log("Loading sample data for all districts...");

    // Load sample of points from different districts
    const codesResponse = await fetch("/api/all_mls_codes");
    if (!codesResponse.ok) throw new Error("Failed to fetch MLS codes");

    const codes = await codesResponse.json();
    const sampleCodes = codes.slice(0, 30); // Sample size
    const pointsData = [];

    for (const code of sampleCodes) {
      try {
        const response = await fetch(`/api/search_mls_code/${encodeURIComponent(code)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.mls_point) {
            pointsData.push(data.mls_point);
          }
        }
      } catch (error) {
        console.warn(`Failed to load data for ${code}:`, error);
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    dashboardData.points = pointsData;
    dashboardData.mandals = [...new Set(pointsData.map(p => p.mandal_name).filter(m => m))];
    filteredData = [...pointsData];

    console.log(`Loaded sample data: ${pointsData.length} points`);

    updateRecentActivity("Data Loaded", `Loaded sample data from ${pointsData.length} MLS points across all districts`);

  } catch (error) {
    console.error("Failed to load all districts data:", error);

    // Fallback to sample data
    console.log("Using fallback sample data...");
    loadFallbackData();
  }
}

// Fallback sample data
function loadFallbackData() {
  const sampleDistricts = ['Guntur', 'Krishna', 'Visakhapatnam', 'Vijayawada', 'Tirupati'];
  const sampleMandals = ['Rural', 'Urban', 'Coastal'];
  const statuses = ['Active', 'Inactive'];

  const sampleData = [];
  for (let i = 1; i <= 25; i++) {
    const district = sampleDistricts[Math.floor(Math.random() * sampleDistricts.length)];
    const mandal = `${district} ${sampleMandals[Math.floor(Math.random() * sampleMandals.length)]}`;
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    sampleData.push({
      mls_point_code: `AP${district.substring(0,2).toUpperCase()}${i.toString().padStart(3, '0')}`,
      mls_point_name: `MLS Point ${district} ${i}`,
      district_name: district,
      mandal_name: mandal,
      village_name: `Village ${i}`,
      status: status,
      mls_point_incharge_name: `Incharge ${i}`,
      phone_number: `+91 ${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      latitude: 15.9 + (Math.random() - 0.5) * 2,
      longitude: 79.7 + (Math.random() - 0.5) * 2,
      mls_point_address: `Address ${i}, ${district}`
    });
  }

  dashboardData.points = sampleData;
  dashboardData.mandals = [...new Set(sampleData.map(p => p.mandal_name))];
  filteredData = [...sampleData];

  updateRecentActivity("Fallback Data", "Using sample data for demonstration");
}

// Load data for selected district
async function loadDistrictData() {
  const districtSelect = document.getElementById('dashboardDistrict');
  const loadBtn = document.getElementById('loadDistrictData');

  const selectedValue = districtSelect.value;

  if (loadBtn) {
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  }

  try {
    if (selectedValue) {
      dashboardData.selectedDistrictCode = selectedValue;
      dashboardData.selectedDistrict = getDistrictName(selectedValue);

      showToast(`Loading data for ${dashboardData.selectedDistrict} district...`, "info");

      await loadDistrictSpecificData(selectedValue);
    } else {
      dashboardData.selectedDistrictCode = null;
      dashboardData.selectedDistrict = null;

      showToast("Loading data for all districts...", "info");

      await loadAllDistrictsData();
    }

    // Update dashboard
    calculateStats();
    updateStatsDisplay();
    updateTable();
    updateSelectionInfo();
    setupChartsWithFallback();

    showToast("Data loaded successfully!", "success");

  } catch (error) {
    console.error("Failed to load district data:", error);
    showToast("Failed to load district data", "error");
  } finally {
    if (loadBtn) {
      loadBtn.disabled = false;
      loadBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Load Data';
    }
  }
}

// Get district name from code
function getDistrictName(districtCode) {
  const district = dashboardData.districts.find(d => {
    if (typeof d === 'string') return d === districtCode;
    return d["District Code"] === districtCode || d.code === districtCode;
  });

  if (typeof district === 'string') return district;
  return district?.["District Name"] || district?.name || districtCode;
}

// Calculate statistics
function calculateStats() {
  const points = dashboardData.points;
  const activePoints = points.filter(p => p.status === 'Active');
  const inactivePoints = points.filter(p => p.status === 'Inactive');
  const mandals = [...new Set(points.map(p => p.mandal_name).filter(m => m))];

  dashboardData.stats = {
    total: points.length,
    active: activePoints.length,
    inactive: inactivePoints.length,
    mandals: mandals.length,
    activePercentage: points.length > 0 ? ((activePoints.length / points.length) * 100).toFixed(1) : 0,
    inactivePercentage: points.length > 0 ? ((inactivePoints.length / points.length) * 100).toFixed(1) : 0
  };

  console.log("Calculated stats:", dashboardData.stats);
}

// Update statistics display
function updateStatsDisplay() {
  const stats = dashboardData.stats;

  document.getElementById('totalMLSPoints').textContent = stats.total;
  document.getElementById('activePoints').textContent = stats.active;
  document.getElementById('inactivePoints').textContent = stats.inactive;
  document.getElementById('totalMandals').textContent = stats.mandals;

  // Update change indicators
  document.getElementById('totalChange').textContent = '+2.5%';
  document.getElementById('activeChange').textContent = `${stats.activePercentage}%`;
  document.getElementById('inactiveChange').textContent = `${stats.inactivePercentage}%`;
  document.getElementById('mandalsChange').textContent = '0%';
}

// Update selection info
function updateSelectionInfo() {
  const selectedDistrictName = document.getElementById('selectedDistrictName');
  const selectedDistrictInfo = document.getElementById('selectedDistrictInfo');
  const selectionPointCount = document.getElementById('selectionPointCount');
  const selectionMandalCount = document.getElementById('selectionMandalCount');
  const lastUpdated = document.getElementById('lastUpdated');

  if (dashboardData.selectedDistrict) {
    selectedDistrictName.textContent = dashboardData.selectedDistrict;
    selectedDistrictInfo.textContent = `Showing detailed data for ${dashboardData.selectedDistrict} district`;
  } else {
    selectedDistrictName.textContent = 'All Districts';
    selectedDistrictInfo.textContent = 'Showing sample data from multiple districts';
  }

  selectionPointCount.textContent = dashboardData.stats.total;
  selectionMandalCount.textContent = dashboardData.stats.mandals;
  lastUpdated.textContent = new Date().toLocaleTimeString();

  // Update chart title
  const chartTitle = document.getElementById('chartTitle');
  if (dashboardData.selectedDistrict) {
    chartTitle.textContent = `${dashboardData.selectedDistrict} - Mandal Distribution`;
  } else {
    chartTitle.textContent = 'District Distribution';
  }

  // Update table title
  const tableTitle = document.getElementById('tableTitle');
  if (dashboardData.selectedDistrict) {
    tableTitle.textContent = `${dashboardData.selectedDistrict} MLS Points`;
  } else {
    tableTitle.textContent = 'MLS Points Overview';
  }
}

// Setup charts with fallback
function setupChartsWithFallback() {
  try {
    if (typeof Chart !== 'undefined') {
      setupCharts();
    } else {
      console.warn("Chart.js not available, using text fallback");
      setupTextCharts();
    }
  } catch (error) {
    console.error("Chart setup failed:", error);
    setupTextCharts();
  }
}

// Setup actual charts
function setupCharts() {
  try {
    // Clear existing charts
    if (dashboardData.charts.distribution) {
      dashboardData.charts.distribution.destroy();
    }
    if (dashboardData.charts.status) {
      dashboardData.charts.status.destroy();
    }

    // Distribution Chart (Mandals or Districts)
    const distributionCtx = document.getElementById('distributionChart');
    if (distributionCtx) {
      const points = dashboardData.points;
      const groupField = dashboardData.selectedDistrict ? 'mandal_name' : 'district_name';
      const counts = {};

      points.forEach(point => {
        const group = point[groupField] || 'Unknown';
        counts[group] = (counts[group] || 0) + 1;
      });

      const sortedGroups = Object.entries(counts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);

      dashboardData.charts.distribution = new Chart(distributionCtx, {
        type: 'bar',
        data: {
          labels: sortedGroups.map(([group]) => group),
          datasets: [{
            label: 'MLS Points',
            data: sortedGroups.map(([,count]) => count),
            backgroundColor: [
              '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
              '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6'
            ],
            borderWidth: 0,
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }

    // Status Chart
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
      const stats = dashboardData.stats;

      dashboardData.charts.status = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: ['Active', 'Inactive'],
          datasets: [{
            data: [stats.active, stats.inactive],
            backgroundColor: ['#10b981', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }

    console.log("Charts updated successfully");

  } catch (error) {
    console.error("Chart creation failed:", error);
    setupTextCharts();
  }
}

// Fallback text charts
function setupTextCharts() {
  const distributionChart = document.getElementById('distributionChart');
  const statusChart = document.getElementById('statusChart');

  if (distributionChart) {
    distributionChart.parentElement.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #64748b;">
        <i class="fas fa-chart-bar" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <h4>${dashboardData.selectedDistrict ? 'Mandal' : 'District'} Distribution</h4>
        <p>Total Points: ${dashboardData.stats.total}</p>
      </div>
    `;
  }

  if (statusChart) {
    statusChart.parentElement.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #64748b;">
        <i class="fas fa-chart-pie" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <h4>Status Overview</h4>
        <p>Active: ${dashboardData.stats.active} | Inactive: ${dashboardData.stats.inactive}</p>
      </div>
    `;
  }
}

// PDF Report Generation
async function generateDistrictReport() {
  try {
    const reportBtn = document.getElementById('districtReportBtn');
    if (reportBtn) {
      reportBtn.disabled = true;
      reportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    }

    showToast("Generating district report...", "info");

    // Ensure jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
      throw new Error("PDF library not loaded");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Report Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    const title = dashboardData.selectedDistrict ?
      `${dashboardData.selectedDistrict} District Report` :
      'MLS Districts Summary Report';
    doc.text(title, 20, 30);

    // Report Info
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, 45);
    doc.text(`Generated by: JPKrishna28`, 20, 55);

    // Summary Statistics
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text('Summary Statistics', 20, 75);

    const stats = dashboardData.stats;
    const summaryData = [
      ['Metric', 'Value'],
      ['Total MLS Points', stats.total.toString()],
      ['Active Points', `${stats.active} (${stats.activePercentage}%)`],
      ['Inactive Points', `${stats.inactive} (${stats.inactivePercentage}%)`],
      ['Total Mandals', stats.mandals.toString()],
      ['District Coverage', dashboardData.selectedDistrict || 'Multiple Districts']
    ];

    doc.autoTable({
      startY: 85,
      head: [summaryData[0]],
      body: summaryData.slice(1),
      theme: 'grid',
      styles: { fontSize: 10 }
    });

    // Detailed Points Table
    const detailStartY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text('Detailed MLS Points', 20, detailStartY);

    const points = dashboardData.points.slice(0, 50); // Limit to 50 points for PDF
    const tableData = points.map(point => [
      point.mls_point_code || 'N/A',
      point.mls_point_name || 'N/A',
      point.mandal_name || 'N/A',
      point.village_name || 'N/A',
      point.status || 'Unknown',
      point.mls_point_incharge_name || 'N/A',
      point.phone_number || 'N/A'
    ]);

    doc.autoTable({
      startY: detailStartY + 10,
      head: [['Code', 'Name', 'Mandal', 'Village', 'Status', 'Incharge', 'Phone']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 30 },
        6: { cellWidth: 30 }
      }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${pageCount}`, 20, 285);
      doc.text('MLS Dashboard Report - Confidential', 150, 285);
    }

    // Save the PDF
    const fileName = dashboardData.selectedDistrict ?
      `${dashboardData.selectedDistrict}_District_Report_${new Date().toISOString().split('T')[0]}.pdf` :
      `MLS_Districts_Summary_${new Date().toISOString().split('T')[0]}.pdf`;

    doc.save(fileName);

    showToast("District report downloaded successfully!", "success");
    updateRecentActivity("Report Generated", `District report downloaded: ${fileName}`);

  } catch (error) {
    console.error("Failed to generate district report:", error);
    showToast("Failed to generate district report", "error");
  } finally {
    const reportBtn = document.getElementById('districtReportBtn');
    if (reportBtn) {
      reportBtn.disabled = false;
      reportBtn.innerHTML = '<i class="fas fa-download"></i> Generate';
    }
  }
}

// Generate Active Points Report
async function generateActivePointsReport() {
  try {
    const reportBtn = document.getElementById('activeReportBtn');
    if (reportBtn) {
      reportBtn.disabled = true;
      reportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    }

    showToast("Generating active points report...", "info");

    const activePoints = dashboardData.points.filter(p => p.status === 'Active');

    if (activePoints.length === 0) {
      showToast("No active points found to generate report", "warning");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    const title = dashboardData.selectedDistrict ?
      `${dashboardData.selectedDistrict} - Active MLS Points Report` :
      'Active MLS Points Report';

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(title, 20, 30);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 45);
    doc.text(`Total Active Points: ${activePoints.length}`, 20, 55);

    // Points table
    const tableData = activePoints.map(point => [
      point.mls_point_code || 'N/A',
      point.mls_point_name || 'N/A',
      point.mandal_name || 'N/A',
      point.mls_point_incharge_name || 'N/A',
      point.phone_number || 'N/A'
    ]);

    doc.autoTable({
      startY: 70,
      head: [['Code', 'Name', 'Mandal', 'Incharge', 'Phone']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    const fileName = `Active_Points_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    showToast("Active points report downloaded!", "success");
    updateRecentActivity("Report Generated", `Active points report: ${activePoints.length} points`);

  } catch (error) {
    console.error("Failed to generate active points report:", error);
    showToast("Failed to generate active points report", "error");
  } finally {
    const reportBtn = document.getElementById('activeReportBtn');
    if (reportBtn) {
      reportBtn.disabled = false;
      reportBtn.innerHTML = '<i class="fas fa-download"></i> Generate';
    }
  }
}

// Update table
function updateTable() {
  populateMandalFilter();
  filterTable();
}

// Populate mandal filter
function populateMandalFilter() {
  const select = document.getElementById('filterMandal');
  if (!select) return;

  const mandals = [...new Set(dashboardData.points.map(p => p.mandal_name).filter(m => m))].sort();

  select.innerHTML = '<option value="">All Mandals</option>';
  mandals.forEach(mandal => {
    select.innerHTML += `<option value="${mandal}">${mandal}</option>`;
  });
}

// Filter table
function filterTable() {
  const searchTerm = document.getElementById('tableSearch')?.value.toLowerCase() || '';
  const statusFilter = document.getElementById('filterStatus')?.value || '';
  const mandalFilter = document.getElementById('filterMandal')?.value || '';

  filteredData = dashboardData.points.filter(point => {
    const matchesSearch = !searchTerm ||
      (point.mls_point_code && point.mls_point_code.toLowerCase().includes(searchTerm)) ||
      (point.mls_point_name && point.mls_point_name.toLowerCase().includes(searchTerm));

    const matchesStatus = !statusFilter || point.status === statusFilter;
    const matchesMandal = !mandalFilter || point.mandal_name === mandalFilter;

    return matchesSearch && matchesStatus && matchesMandal;
  });

  currentPage = 1;
  renderTable();
  updatePagination();
}

// Render table
function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = filteredData.slice(startIndex, endIndex);

  if (pageData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: #64748b; padding: 2rem;">
          No MLS points found matching your criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pageData.map(point => `
    <tr>
      <td><strong>${point.mls_point_code || 'N/A'}</strong></td>
      <td>${point.mls_point_name || 'N/A'}</td>
      <td>${point.mandal_name || 'N/A'}</td>
      <td>${point.village_name || 'N/A'}</td>
      <td>
        <span class="status-badge ${(point.status || '').toLowerCase()}">
          ${point.status || 'Unknown'}
        </span>
      </td>
      <td>${point.mls_point_incharge_name || 'N/A'}</td>
      <td>${point.phone_number || 'N/A'}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn view" onclick="viewPoint('${point.mls_point_code}')" title="View Details">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Update pagination
function updatePagination() {
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, filteredData.length);

  const paginationInfo = document.getElementById('paginationInfo');
  if (paginationInfo) {
    paginationInfo.textContent = `Showing ${start} - ${end} of ${filteredData.length} entries`;
  }

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// Setup event listeners
function setupEventListeners() {
  // Table search
  const tableSearch = document.getElementById('tableSearch');
  if (tableSearch) {
    tableSearch.addEventListener('input', filterTable);
  }

  // Table filters
  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) {
    filterStatus.addEventListener('change', filterTable);
  }

  const filterMandal = document.getElementById('filterMandal');
  if (filterMandal) {
    filterMandal.addEventListener('change', filterTable);
  }
}

// Recent Activity Management
function updateRecentActivity(title, description) {
  const activityList = document.getElementById('activityList');
  if (!activityList) return;

  const newActivity = `
    <div class="activity-item">
      <div class="activity-icon update">
        <i class="fas fa-sync-alt"></i>
      </div>
      <div class="activity-content">
        <div class="activity-title">${title}</div>
        <div class="activity-description">${description}</div>
        <div class="activity-time">Just now</div>
      </div>
    </div>
  `;

  // Add new activity at the top
  activityList.insertAdjacentHTML('afterbegin', newActivity);

  // Keep only the latest 5 activities
  const activities = activityList.querySelectorAll('.activity-item');
  if (activities.length > 5) {
    activities[activities.length - 1].remove();
  }
}

// UI State Management
function showLoadingState() {
  document.getElementById('dashboardLoading').style.display = 'block';
  document.getElementById('dashboardContent').style.display = 'none';
  document.getElementById('dashboardError').style.display = 'none';
}

function showDashboardContent() {
  document.getElementById('dashboardLoading').style.display = 'none';
  document.getElementById('dashboardContent').style.display = 'block';
  document.getElementById('dashboardError').style.display = 'none';
}

function showErrorState(message) {
  document.getElementById('dashboardLoading').style.display = 'none';
  document.getElementById('dashboardContent').style.display = 'none';
  document.getElementById('dashboardError').style.display = 'block';

  const errorElement = document.getElementById('dashboardError');
  if (errorElement) {
    const messageElement = errorElement.querySelector('p');
    if (messageElement) {
      messageElement.textContent = message || 'There was an error loading the dashboard.';
    }
  }
}

// Toast notifications
function showToast(message, type = 'info', duration = 4000) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const icon = toast.querySelector('.toast-icon');
  const messageEl = toast.querySelector('.toast-message');

  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };

  if (icon) icon.className = `toast-icon ${icons[type] || icons.info}`;
  if (messageEl) messageEl.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// Global functions for HTML onclick events
window.goToMapView = function() {
  window.location.href = 'index.html';
};

window.loadDistrictData = loadDistrictData;

window.refreshDashboard = function() {
  location.reload();
};

window.loadRecentActivity = function() {
  updateRecentActivity("Activity Refreshed", "Recent activity list has been updated");
  showToast("Activity refreshed", "success");
};

window.generateDistrictReport = generateDistrictReport;
window.generateActivePointsReport = generateActivePointsReport;

window.generateMandalReport = function() {
  showToast("Mandal report generation will be implemented soon", "info");
};

window.generatePerformanceReport = function() {
  showToast("Performance report generation will be implemented soon", "info");
};

window.previousPage = function() {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
    updatePagination();
  }
};

window.nextPage = function() {
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderTable();
    updatePagination();
  }
};

window.viewPoint = function(mlsCode) {
  window.location.href = `index.html?point=${encodeURIComponent(mlsCode)}`;
};

console.log("Enhanced Dashboard script loaded successfully");