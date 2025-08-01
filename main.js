// Global Variables
let map, markersGroup, currentMLSCode = null, allMLSCodes = [], currentPoints = [];
let currentMLSPoint = null; // Store current selected MLS point data
let allLoadedPoints = []; // Store all points that have been loaded/searched

// Initialize Application
document.addEventListener("DOMContentLoaded", function () {
  console.log("Initializing MLS Point Locator...");

  try {
    initMap();
    loadUserInfo();
    checkHealth();
    loadDistricts();
    loadAllMLSCodes();
    setupAutocomplete();
    setupEventListeners();
    setInterval(checkHealth, 30000);
    updateStats();
  } catch (error) {
    console.error("Failed to initialize application:", error);
    showStatusBanner("Failed to initialize application. Please refresh the page.", "error");
  }
});

// Map Initialization
function initMap() {
  try {
    console.log("Initializing map...");
    map = L.map("map").setView([15.9129, 79.7400], 7);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors | MLS Locator",
      maxZoom: 18
    }).addTo(map);

    markersGroup = L.layerGroup().addTo(map);
    console.log("Map initialized successfully");
  } catch (error) {
    console.error("Failed to initialize map:", error);
    showStatusBanner("Failed to load map. Please check your internet connection.", "error");
  }
}

// User Info & Health Check
async function loadUserInfo() {
  try {
    const response = await fetch("/api/user");
    if (response.ok) {
      const userData = await response.json();
      document.getElementById("currentUser").textContent = userData.user || "JPKrishna28";
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn("Failed to load user info, using fallback:", error);
    document.getElementById("currentUser").textContent = "JPKrishna28";
  }
}

async function checkHealth() {
  const statusIndicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");

  try {
    const response = await fetch("/api/health");
    if (response.ok) {
      statusText.textContent = "Online";
      statusIndicator.style.color = "#10b981";
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn("Health check failed, using offline mode:", error);
    statusText.textContent = "Demo Mode";
    statusIndicator.style.color = "#f59e0b";
  }
}

// Status Banner System
function showStatusBanner(message, type = "info", duration = 4000) {
  const banner = document.getElementById("statusBanner");
  const text = document.getElementById("bannerText");

  if (!banner || !text) {
    console.warn("Status banner elements not found");
    return;
  }

  text.textContent = message;
  banner.className = `status-banner ${type} show`;

  setTimeout(() => {
    banner.classList.remove("show");
  }, duration);
}

// Load MLS Codes with fallback
async function loadAllMLSCodes() {
  try {
    console.log("Loading MLS codes...");
    const response = await fetch("/api/all_mls_codes");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      allMLSCodes = data;
      console.log(`Loaded ${allMLSCodes.length} MLS codes`);
      updateStats();
    } else {
      throw new Error("Invalid data format received");
    }
  } catch (error) {
    console.warn("Failed to load MLS codes, using fallback data:", error);
    // Fallback MLS codes for demo - ADDED COMMON CODES
    allMLSCodes = [
      "2821029", "2821030", "2821031", "2821032", "2821033", "2821041", "2818035", "2812021",
      "MLS001", "MLS002", "MLS003", "MLS004", "MLS005",
      "AP001", "AP002", "AP003", "AP004", "AP005"
    ];
    showStatusBanner("Using demo data - API connection failed.", "warning");
    updateStats();
  }
}

// Autocomplete Setup
function setupAutocomplete() {
  const searchInput = document.getElementById("mlsCodeSearch");
  const dropdown = document.getElementById("autocompleteDropdown");

  if (!searchInput || !dropdown) {
    console.warn("Autocomplete elements not found");
    return;
  }

  searchInput.addEventListener("input", function () {
    const query = this.value.trim().toLowerCase();
    if (query.length < 2) {
      dropdown.style.display = "none";
      return;
    }

    const matches = allMLSCodes
      .filter(code => code && code.toLowerCase().includes(query))
      .slice(0, 8);

    if (matches.length > 0) {
      dropdown.innerHTML = matches
        .map(code => `<div class="autocomplete-item" onclick="selectMLSCode('${code}')">${code}</div>`)
        .join("");
      dropdown.style.display = "block";
    } else {
      dropdown.style.display = "none";
    }
  });

  searchInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      dropdown.style.display = "none";
      searchByMLSCode();
    }
  });

  document.addEventListener("click", function (e) {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = "none";
    }
  });
}

function selectMLSCode(code) {
  const searchInput = document.getElementById("mlsCodeSearch");
  const dropdown = document.getElementById("autocompleteDropdown");

  if (searchInput && dropdown) {
    searchInput.value = code;
    dropdown.style.display = "none";
    searchByMLSCode();
  }
}

// Event Listeners
function setupEventListeners() {
  const districtSelect = document.getElementById("district");
  const mandalSelect = document.getElementById("mandal");
  const loadBtn = document.getElementById("loadBtn");

  if (districtSelect) {
    districtSelect.addEventListener("change", function () {
      if (this.value) {
        loadMandals(this.value);
        updateStats();
      } else {
        if (mandalSelect) {
          mandalSelect.innerHTML = '<option value="">Choose a mandal...</option>';
          mandalSelect.disabled = true;
        }
        if (loadBtn) {
          loadBtn.disabled = true;
        }
        updateStats();
      }
    });
  }

  if (mandalSelect) {
    mandalSelect.addEventListener("change", function () {
      if (loadBtn) {
        loadBtn.disabled = !this.value;
      }
      updateStats();
    });
  }
}

// Load Districts with fallback
async function loadDistricts() {
  try {
    console.log("Loading districts...");
    const response = await fetch("/api/districts");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const districts = await response.json();
    console.log("Districts received:", districts);

    const districtSelect = document.getElementById("district");
    if (!districtSelect) {
      console.warn("District select element not found");
      return;
    }

    districtSelect.innerHTML = '<option value="">Choose a district...</option>';

    if (Array.isArray(districts) && districts.length > 0) {
      districts.forEach(district => {
        const option = document.createElement("option");

        // Handle different data structures
        if (typeof district === 'string') {
          option.value = district;
          option.textContent = district;
        } else if (district["District Code"] && district["District Name"]) {
          option.value = district["District Code"];
          option.textContent = district["District Name"];
        } else if (district.code && district.name) {
          option.value = district.code;
          option.textContent = district.name;
        } else if (district.district_code && district.district_name) {
          option.value = district.district_code;
          option.textContent = district.district_name;
        } else {
          console.warn("Unknown district format:", district);
          return;
        }

        districtSelect.appendChild(option);
      });
      console.log(`Loaded ${districts.length} districts successfully`);
    } else {
      throw new Error("No districts found or invalid format");
    }
  } catch (error) {
    console.warn("Failed to load districts, using fallback data:", error);
    loadFallbackDistricts();
    showStatusBanner("Using demo districts - API connection failed.", "warning");
  }
}

// Fallback districts for demo
function loadFallbackDistricts() {
  const districtSelect = document.getElementById("district");
  if (!districtSelect) return;

  const fallbackDistricts = [
    { code: "ANTP", name: "Anantapur" },
    { code: "CHTR", name: "Chittoor" },
    { code: "EAST", name: "East Godavari" },
    { code: "GNTR", name: "Guntur" },
    { code: "KADP", name: "Kadapa" },
    { code: "KRSN", name: "Krishna" },
    { code: "KRNL", name: "Kurnool" },
    { code: "NLLR", name: "Nellore" },
    { code: "PRKM", name: "Prakasam" },
    { code: "SRKL", name: "Srikakulam" },
    { code: "VSKP", name: "Visakhapatnam" },
    { code: "VIJN", name: "Vijayawada" },
    { code: "WEST", name: "West Godavari" }
  ];

  districtSelect.innerHTML = '<option value="">Choose a district...</option>';

  fallbackDistricts.forEach(district => {
    const option = document.createElement("option");
    option.value = district.code;
    option.textContent = district.name;
    districtSelect.appendChild(option);
  });

  console.log(`Loaded ${fallbackDistricts.length} fallback districts`);
}

// Load Mandals with fallback - REMOVED DEMO MANDALS
async function loadMandals(districtCode) {
  try {
    console.log("Loading mandals for district:", districtCode);
    const response = await fetch(`/api/mandals/${encodeURIComponent(districtCode)}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const mandals = await response.json();
    console.log("Mandals received:", mandals);

    const mandalSelect = document.getElementById("mandal");
    if (!mandalSelect) {
      console.warn("Mandal select element not found");
      return;
    }

    mandalSelect.innerHTML = '<option value="">Choose a mandal...</option>';

    if (Array.isArray(mandals) && mandals.length > 0) {
      mandals.forEach(mandal => {
        const option = document.createElement("option");

        // Handle different data structures
        if (typeof mandal === 'string') {
          option.value = mandal;
          option.textContent = mandal;
        } else if (mandal["Mandal Code"] && mandal["Mandal Name"]) {
          option.value = mandal["Mandal Code"];
          option.textContent = mandal["Mandal Name"];
        } else if (mandal.code && mandal.name) {
          option.value = mandal.code;
          option.textContent = mandal.name;
        } else if (mandal.mandal_code && mandal.mandal_name) {
          option.value = mandal.mandal_code;
          option.textContent = mandal.mandal_name;
        } else {
          console.warn("Unknown mandal format:", mandal);
          return;
        }

        mandalSelect.appendChild(option);
      });

      mandalSelect.disabled = false;
      console.log(`Loaded ${mandals.length} mandals successfully`);
    } else {
      throw new Error("No mandals found");
    }
  } catch (error) {
    console.warn("Failed to load mandals:", error);
    const mandalSelect = document.getElementById("mandal");
    if (mandalSelect) {
      mandalSelect.innerHTML = '<option value="">No mandals available</option>';
      mandalSelect.disabled = true;
    }
    showStatusBanner("No mandals found for selected district.", "warning");
  }
}

// Load MLS Points by District/Mandal
async function loadMLSPoints() {
  const districtCode = document.getElementById("district").value;
  const mandalCode = document.getElementById("mandal").value;
  const loadBtn = document.getElementById("loadBtn");

  if (!districtCode || !mandalCode) {
    showStatusBanner("Please select both district and mandal.", "warning");
    return;
  }

  if (loadBtn) {
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  }

  showLoadingState("Loading MLS Points...");

  try {
    console.log("Loading MLS points for:", districtCode, mandalCode);
    const response = await fetch(`/api/mls_points/${encodeURIComponent(districtCode)}/${encodeURIComponent(mandalCode)}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const points = await response.json();
    console.log("MLS points received:", points);
    currentPoints = points;
    // Store actual API data in allLoadedPoints
    points.forEach(point => {
      const existingIndex = allLoadedPoints.findIndex(p => p.mls_point_code === point.mls_point_code);
      if (existingIndex >= 0) {
        allLoadedPoints[existingIndex] = point; // Update with real data
      } else {
        allLoadedPoints.push(point); // Add new real data
      }
    });

    if (!points || points.length === 0) {
      throw new Error("No MLS points found");
    }

    displayMLSPoints(points);

  } catch (error) {
    console.warn("Failed to load MLS points:", error);
    showStatusBanner("No MLS points found for the selected area.", "info");
    showErrorState("No MLS points found for the selected district and mandal.");
  } finally {
    if (loadBtn) {
      loadBtn.disabled = false;
      loadBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Load Points';
    }
  }
}

// Display MLS Points on map
function displayMLSPoints(points) {
  markersGroup.clearLayers();
  const bounds = L.latLngBounds();
  let validPoints = 0;

  points.forEach(point => {
    const lat = parseFloat(point.latitude);
    const lng = parseFloat(point.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn("Invalid coordinates for point:", point);
      return;
    }

    const marker = L.marker([lat, lng])
      .bindPopup(createMarkerPopup(point))
      .addTo(markersGroup);

    // FIXED: Store point data in marker for easy access
    marker.mlsPointData = point;

    // Add click event to show details
    marker.on('click', function() {
      showMLSDetails(point);
    });

    bounds.extend([lat, lng]);
    validPoints++;
  });

  if (validPoints > 0) {
    map.fitBounds(bounds, { padding: [20, 20] });
    showPointsSummary(points);
    updateStats();
    showStatusBanner(`Successfully loaded ${validPoints} MLS points.`, "success");
  } else {
    showErrorState("No valid coordinates found in the data");
  }
}

// FIXED: Search by MLS Code - Always try API first
async function searchByMLSCode() {
  const mlsCode = document.getElementById("mlsCodeSearch").value.trim();
  const searchBtn = document.getElementById("searchBtn");

  if (!mlsCode) {
    showStatusBanner("Please enter a valid MLS Point Code.", "warning");
    return;
  }

  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
  }

  showLoadingState("Searching for MLS Code: " + mlsCode);

  try {
    console.log("Searching for MLS code:", mlsCode);
    const response = await fetch(`/api/search_mls_code/${encodeURIComponent(mlsCode)}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Search response:", data);

    if (!data.success) {
      throw new Error(data.error || "MLS code not found");
    }

    const point = data.mls_point;

    // Store the REAL API data, replacing any demo data
    const existingIndex = allLoadedPoints.findIndex(p => p.mls_point_code === point.mls_point_code);
    if (existingIndex >= 0) {
      allLoadedPoints[existingIndex] = point; // Replace with real data
    } else {
      allLoadedPoints.push(point); // Add real data
    }

    displaySinglePoint(point);
    showStatusBanner("MLS Point found successfully!", "success");

  } catch (error) {
    console.warn("Search failed, MLS point not found:", error);
    showStatusBanner(`No MLS Point found for code: ${mlsCode}`, "error");
    showErrorState(`MLS Point with code "${mlsCode}" not found in the database.`);
  } finally {
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.innerHTML = '<i class="fas fa-search"></i> Search Point';
    }
  }
}

// Display single point
function displaySinglePoint(point) {
  const lat = parseFloat(point.latitude);
  const lng = parseFloat(point.longitude);

  if (isNaN(lat) || isNaN(lng)) {
    showErrorState("Invalid coordinates received from server");
    return;
  }

  // Clear existing markers and add new one
  markersGroup.clearLayers();

  const marker = L.marker([lat, lng])
    .bindPopup(createMarkerPopup(point))
    .addTo(markersGroup);

  // FIXED: Store point data in marker
  marker.mlsPointData = point;

  // Add click event to marker
  marker.on('click', function() {
    showMLSDetails(point);
  });

  // Center map and open popup
  map.setView([lat, lng], 15);
  marker.openPopup();

  // Show the details immediately
  showMLSDetails(point);
  currentMLSCode = point.mls_point_code;
}

// FIXED: Create Marker Popup with proper data handling
function createMarkerPopup(point) {
  const statusClass = (point.status === "Active") ? "active" : "inactive";

  return `
    <div class="marker-popup">
      <h4>${point.mls_point_code || 'N/A'}</h4>
      <p><strong>Name:</strong> ${point.mls_point_name || 'N/A'}</p>
      <p><strong>District:</strong> ${point.district_name || 'N/A'}</p>
      <p><strong>Mandal:</strong> ${point.mandal_name || 'N/A'}</p>
      <p><strong>Village:</strong> ${point.village_name || 'N/A'}</p>
      <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${point.status || 'Unknown'}</span></p>
      <button class="btn btn-primary" onclick="showMLSDetailsFromMarker('${point.mls_point_code}')">
        <i class="fas fa-eye"></i> View Details
      </button>
    </div>
  `;
}

// FIXED: Function to show MLS details from marker popup
function showMLSDetailsFromMarker(mlsCode) {
  console.log("Showing details for MLS code from marker:", mlsCode);

  // Find the point in allLoadedPoints first
  let point = allLoadedPoints.find(p => p.mls_point_code === mlsCode);

  // If not found, look in map markers
  if (!point) {
    markersGroup.eachLayer(function(marker) {
      if (marker.mlsPointData && marker.mlsPointData.mls_point_code === mlsCode) {
        point = marker.mlsPointData;
      }
    });
  }

  if (point) {
    // Store in allLoadedPoints if not already there
    const existingIndex = allLoadedPoints.findIndex(p => p.mls_point_code === point.mls_point_code);
    if (existingIndex < 0) {
      allLoadedPoints.push(point);
    }
    showMLSDetails(point);
  } else {
    console.warn(`Point ${mlsCode} not found, triggering search`);
    // Automatically search for the MLS code
    const searchInput = document.getElementById("mlsCodeSearch");
    if (searchInput) {
      searchInput.value = mlsCode;
      searchByMLSCode();
    }
  }
}

// ALIAS for backward compatibility
function showMLSDetailsFromPopup(mlsCode) {
  showMLSDetailsFromMarker(mlsCode);
}

// Show MLS Details
function showMLSDetails(point) {
  const detailsPanel = document.getElementById("detailsPanel");
  if (!detailsPanel) {
    console.warn("Details panel not found");
    return;
  }

  // Store current point for PDF generation
  currentMLSPoint = point;

  const statusClass = (point.status === "Active") ? "active" : "inactive";

  detailsPanel.innerHTML = `
    <div class="details-header">
      <div class="details-title">MLS Point Details</div>
      <div class="details-subtitle">${point.mls_point_code || 'N/A'}</div>
    </div>
    <div class="details-content fade-in">
      <div class="detail-item">
        <div class="detail-label">MLS Point Code</div>
        <div class="detail-value">${point.mls_point_code || 'N/A'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Point Name</div>
        <div class="detail-value">${point.mls_point_name || 'N/A'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">District</div>
        <div class="detail-value">${point.district_name || 'N/A'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Mandal</div>
        <div class="detail-value">${point.mandal_name || 'N/A'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Village</div>
        <div class="detail-value">${point.village_name || 'N/A'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Coordinates</div>
        <div class="detail-value">${point.latitude || 'N/A'}, ${point.longitude || 'N/A'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Status</div>
        <div class="detail-value">
          <span class="status-badge ${statusClass}">${point.status || 'Unknown'}</span>
        </div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Address</div>
        <div class="detail-value">${point.mls_point_address || 'N/A'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Incharge Name</div>
        <div class="detail-value">${point.mls_point_incharge_name || 'N/A'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Phone Number</div>
        <div class="detail-value">${point.phone_number || 'N/A'}</div>
      </div>
      ${point.aadhaar_number ? `
      <div class="detail-item">
        <div class="detail-label">Aadhaar Number</div>
        <div class="detail-value">${point.aadhaar_number}</div>
      </div>
      ` : ''}
      ${point.designation ? `
      <div class="detail-item">
        <div class="detail-label">Designation</div>
        <div class="detail-value">${point.designation}</div>
      </div>
      ` : ''}
    </div>
    <div class="download-section">
      <button class="btn btn-pdf-preview" onclick="previewPDF()">
        <i class="fas fa-eye"></i>
        Preview PDF Template
      </button>
      <button class="btn btn-download" onclick="downloadPDF('${point.mls_point_code || ''}')">
        <i class="fas fa-file-pdf"></i>
        Download PDF Report
      </button>
    </div>
  `;
}

// Show Points Summary
function showPointsSummary(points) {
  const detailsPanel = document.getElementById("detailsPanel");
  if (!detailsPanel) return;

  detailsPanel.innerHTML = `
    <div class="details-header">
      <div class="details-title">MLS Points Summary</div>
      <div class="details-subtitle">${points.length} points found</div>
    </div>
    <div class="details-content fade-in">
      <div style="overflow-x: auto;">
        <table class="points-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Incharge</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${points.map(point => `
              <tr>
                <td><strong>${point.mls_point_code || 'N/A'}</strong></td>
                <td>${point.mls_point_name || 'N/A'}</td>
                <td>${point.mls_point_incharge_name || 'N/A'}</td>
                <td>${point.phone_number || 'N/A'}</td>
                <td>
                  <span class="status-badge ${(point.status || '').toLowerCase()}">
                    ${point.status || 'Unknown'}
                  </span>
                </td>
                <td>
                  <button class="table-btn" onclick="selectMLSPointFromTable('${point.mls_point_code}')">
                    <i class="fas fa-eye"></i> View
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 1rem; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <p style="color: #64748b; font-size: 0.9rem; margin: 0;">
          <i class="fas fa-info-circle"></i>
          Click "View" to see detailed information for any MLS point, or click on markers on the map.
        </p>
      </div>
    </div>
  `;
}

// FIXED: Select MLS Point from table - automatically search if not found
function selectMLSPointFromTable(mlsCode) {
  if (!mlsCode) return;

  console.log("Looking for MLS code:", mlsCode);

  // Find in current points first, then all loaded points
  let point = currentPoints.find(p => p.mls_point_code === mlsCode);

  if (!point) {
    point = allLoadedPoints.find(p => p.mls_point_code === mlsCode);
  }

  if (point) {
    showMLSDetails(point);

    // Center map on selected point if coordinates are available
    if (point.latitude && point.longitude) {
      const lat = parseFloat(point.latitude);
      const lng = parseFloat(point.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        map.setView([lat, lng], 15);

        // Highlight the marker
        markersGroup.eachLayer(function(marker) {
          if (Math.abs(marker.getLatLng().lat - lat) < 0.0001 &&
              Math.abs(marker.getLatLng().lng - lng) < 0.0001) {
            marker.openPopup();
          }
        });
      }
    }
  } else {
    // If not found in loaded data, automatically search for it
    console.log(`Point ${mlsCode} not found locally, searching via API...`);
    const searchInput = document.getElementById("mlsCodeSearch");
    if (searchInput) {
      searchInput.value = mlsCode;
      searchByMLSCode(); // This will trigger the API search
    } else {
      showStatusBanner(`MLS Point ${mlsCode} data not available. Please search for it manually.`, "warning");
    }
  }
}

// COMPLETELY FIXED: PDF Generation with simple, working template
function createPDFTemplate(point) {
  if (!point) {
    console.warn("No MLS point data available for PDF generation");
    return '';
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

  return `
<html>
<head>
<meta charset="utf-8">
<title>MLS Report</title>
<style>
body { font-family: Arial, sans-serif; margin: 20px; color: #000; background: #fff; }
.header { background: #1757A6; color: white; text-align: center; padding: 15px; font-size: 20px; font-weight: bold; margin-bottom: 15px; }
.info { text-align: right; margin-bottom: 15px; font-size: 12px; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
.section { margin-bottom: 20px; }
.section-title { background: #1757A6; color: white; padding: 10px; font-weight: bold; font-size: 16px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
th, td { border: 1px solid #333; padding: 8px; text-align: left; }
th { background: #f5f6fa; font-weight: bold; }
.flex { display: flex; gap: 20px; margin-bottom: 15px; }
.flex-left { flex: 3; }
.flex-right { flex: 1; text-align: center; }
.photo-box { border: 1px solid #1757A6; height: 100px; width: 80px; display: flex; align-items: center; justify-content: center; margin: 0 auto; font-size: 12px; color: #1757A6; }
</style>
</head>
<body>

<div class="header">MLS AT A GLANCE</div>

<div class="info">
Generated on: ${formattedDateTime} (UTC)<br>
Generated by: JPKrishna28
</div>

<div class="section">
<div class="section-title">🏢 MLS Point Details</div>
<table>
<tr><th style="width: 40%;">MLS Point Code</th><td>${point.mls_point_code || ''}</td></tr>
<tr><th>MLS Point Name</th><td>${point.mls_point_name || ''}</td></tr>
<tr><th>District Name</th><td>${point.district_name || ''}</td></tr>
<tr><th>Mandal Name</th><td>${point.mandal_name || ''}</td></tr>
<tr><th>Village Name</th><td>${point.village_name || ''}</td></tr>
<tr><th>Address</th><td>${point.mls_point_address || ''}</td></tr>
<tr><th>Latitude</th><td>${point.latitude || ''}</td></tr>
<tr><th>Longitude</th><td>${point.longitude || ''}</td></tr>
<tr><th>Status</th><td>${point.status || ''}</td></tr>
</table>
</div>

<div class="flex">
<div class="flex-left">
<div class="section-title">👤 Incharge Details</div>
<table>
<tr><th style="width: 50%;">EMP ID</th><td>${point.emp_id || ''}</td></tr>
<tr><th>Name</th><td>${point.mls_point_incharge_name || ''}</td></tr>
<tr><th>Designation</th><td>${point.designation || ''}</td></tr>
<tr><th>Aadhaar</th><td>${point.aadhaar_number || ''}</td></tr>
<tr><th>Phone</th><td>${point.phone_number || ''}</td></tr>
</table>
</div>
<div class="flex-right">
<div class="photo-box">MLS<br>Incharge<br>Photo</div>
</div>
</div>

<div class="flex">
<div class="flex-left">
<div class="section-title">🧑‍💼 DEO Details</div>
<table>
<tr><th style="width: 50%;">EMP ID</th><td></td></tr>
<tr><th>Name</th><td></td></tr>
<tr><th>Aadhaar</th><td></td></tr>
<tr><th>Phone</th><td></td></tr>
</table>
</div>
<div class="flex-right">
<div class="photo-box">DEO<br>Photo</div>
</div>
</div>

<div class="section">
<div class="section-title">🏢 Physical Details</div>
<table>
<tr><th>Block Name</th><th>Dimensions</th><th>Area (Sq.Ft)</th><th>Capacity (MT)</th><th>Owned/Hired</th></tr>
<tr><td></td><td></td><td></td><td></td><td></td></tr>
</table>
</div>

<div class="section">
<div class="section-title">🏠 Rental Details</div>
<table>
<tr><th>Rented From</th><th>Period</th><th>Charges</th></tr>
<tr><td></td><td></td><td></td></tr>
</table>
</div>

<div class="section">
<div class="section-title">🖼 Location Images</div>
<table>
<tr><th>Entrance</th><th>Exit</th><th>Loading</th><th>Unloading</th><th>Storage 1</th><th>Storage 2</th></tr>
<tr><td>🖼</td><td>🖼</td><td>🖼</td><td>🖼</td><td>🖼</td><td>🖼</td></tr>
</table>
</div>

<div class="section">
<div class="section-title">👷‍♂ Hamalies Details</div>
<table>
<tr><th>Engaged</th><th>Rate/Quintal</th><th>Rate/Carton</th><th>Rate/Bale</th></tr>
<tr><td></td><td></td><td></td><td></td></tr>
</table>
</div>

<div class="section">
<div class="section-title">📦 Current Month Commodities</div>
<table>
<tr><th style="width: 5%;">SL</th><th style="width: 25%;">Commodity</th><th>Opening</th><th>Received</th><th>Issued</th><th>Closing</th></tr>
<tr><td>1</td><td>Fortified Rice</td><td></td><td></td><td></td><td></td></tr>
<tr><td>2</td><td>Fine Quality Rice</td><td></td><td></td><td></td><td></td></tr>
<tr><td>3</td><td>Sugar</td><td></td><td></td><td></td><td></td></tr>
<tr><td>4</td><td>P. Oil ½ Ltr.</td><td></td><td></td><td></td><td></td></tr>
<tr><td>5</td><td>P. Oil 1 Ltr.</td><td></td><td></td><td></td><td></td></tr>
<tr><td>6</td><td>RG Dall 1Kg</td><td></td><td></td><td></td><td></td></tr>
<tr><td>7</td><td>RG Dall</td><td></td><td></td><td></td><td></td></tr>
<tr><td>8</td><td>Jowar</td><td></td><td></td><td></td><td></td></tr>
</table>
</div>

<div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
Generated by MLS Point Locator System | ${formattedDateTime} (UTC) | User: JPKrishna28
</div>

</body>
</html>
  `;
}

// FIXED: Preview PDF Function
function previewPDF() {
  if (!currentMLSPoint) {
    showStatusBanner("No MLS point selected for PDF preview.", "warning");
    return;
  }

  console.log("Preview PDF clicked, currentMLSPoint:", currentMLSPoint);
  showStatusBanner("Generating PDF preview...", "info");

  try {
    const pdfContent = createPDFTemplate(currentMLSPoint);
    let container = document.getElementById("pdfTemplateContainer");

    if (!container) {
      container = document.createElement("div");
      container.id = "pdfTemplateContainer";
      document.body.appendChild(container);
    }

    container.innerHTML = pdfContent;
    container.style.display = "block";
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.background = "rgba(0,0,0,0.9)";
    container.style.zIndex = "10000";
    container.style.overflow = "auto";
    container.style.padding = "20px";

    // Add close button
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = '✕ Close Preview';
    closeBtn.style.position = "fixed";
    closeBtn.style.top = "20px";
    closeBtn.style.right = "20px";
    closeBtn.style.zIndex = "10001";
    closeBtn.style.padding = "10px 20px";
    closeBtn.style.background = "#ef4444";
    closeBtn.style.color = "white";
    closeBtn.style.border = "none";
    closeBtn.style.borderRadius = "5px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "14px";
    closeBtn.style.fontWeight = "600";

    closeBtn.onclick = function() {
      container.style.display = "none";
      container.innerHTML = "";
    };

    container.appendChild(closeBtn);
    showStatusBanner("PDF preview ready!", "success");

  } catch (error) {
    console.error("Failed to generate PDF preview:", error);
    showStatusBanner("Failed to generate PDF preview.", "error");
  }
}

// COMPLETELY FIXED: PDF Download Function
async function downloadPDF(mlsCode) {
  if (!currentMLSPoint) {
    showStatusBanner("No MLS point selected for PDF generation.", "warning");
    return;
  }

  console.log("Download PDF clicked, currentMLSPoint:", currentMLSPoint);
  showStatusBanner("Generating PDF...", "info");

  try {
    const pdfContent = createPDFTemplate(currentMLSPoint);

    // Create a simple div with the content
    const element = document.createElement('div');
    element.innerHTML = pdfContent;
    element.style.background = 'white';
    element.style.width = '800px';
    element.style.margin = '0 auto';

    // Temporarily add to body
    document.body.appendChild(element);

    const currentDate = new Date().toISOString().slice(0, 10);

    const opt = {
      margin: 0.5,
      filename: `MLS_Report_${mlsCode}_${currentDate}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      },
      jsPDF: {
        unit: 'in',
        format: 'a4',
        orientation: 'portrait'
      }
    };

    // Generate and save PDF
    await html2pdf().set(opt).from(element).save();

    // Remove temporary element
    document.body.removeChild(element);

    showStatusBanner("PDF downloaded successfully!", "success");

  } catch (error) {
    console.error("Failed to generate PDF:", error);
    showStatusBanner("Failed to generate PDF. Please try again.", "error");
  }
}

// Utility Functions
function clearSearch() {
  const searchInput = document.getElementById("mlsCodeSearch");
  const dropdown = document.getElementById("autocompleteDropdown");

  if (searchInput) searchInput.value = "";
  if (dropdown) dropdown.style.display = "none";
  clearMapAndDetails();
}

function clearMapAndDetails() {
  if (markersGroup) markersGroup.clearLayers();
  if (map) map.setView([15.9129, 79.7400], 7);
  currentMLSCode = null;
  currentPoints = [];
  currentMLSPoint = null;
  showEmptyState();
  updateStats();
}

function updateStats() {
  const totalPointsEl = document.getElementById("totalPoints");
  const activePointsEl = document.getElementById("activePoints");

  if (totalPointsEl) {
    totalPointsEl.textContent = currentPoints.length || allMLSCodes.length || 0;
  }

  if (activePointsEl) {
    const activeCount = currentPoints.filter(point => point.status === "Active").length;
    activePointsEl.textContent = activeCount || 0;
  }
}

function showEmptyState() {
  const detailsPanel = document.getElementById("detailsPanel");
  if (detailsPanel) {
    detailsPanel.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-map-marker-alt"></i>
        </div>
        <h3>Welcome to MLS Locator</h3>
        <p>
          Select an MLS point from the map or use the search functionality to view detailed information and generate reports.
        </p>
      </div>
    `;
  }
}

function showLoadingState(message) {
  const detailsPanel = document.getElementById("detailsPanel");
  if (detailsPanel) {
    detailsPanel.innerHTML = `
      <div class="details-header">
        <div class="details-title">Loading...</div>
        <div class="details-subtitle">Please wait</div>
      </div>
      <div class="loading">
        <div class="loading-spinner"></div>
        <span>${message}</span>
      </div>
    `;
  }
}

function showErrorState(message) {
  const detailsPanel = document.getElementById("detailsPanel");
  if (detailsPanel) {
    detailsPanel.innerHTML = `
      <div class="details-header">
        <div class="details-title">Error</div>
        <div class="details-subtitle">Something went wrong</div>
      </div>
      <div class="empty-state">
        <div class="empty-state-icon" style="color: #ef4444;">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3>Error</h3>
        <p>${message}</p>
        <button class="btn btn-primary" onclick="clearMapAndDetails()" style="width: auto; margin-top: 1rem;">
          <i class="fas fa-refresh"></i>
          Try Again
        </button>
      </div>
    `;
  }
}

// Map Controls
function resetMapView() {
  if (map) {
    map.setView([15.9129, 79.7400], 7);
    showStatusBanner("Map view reset to default", "info", 2000);
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      showStatusBanner("Fullscreen not supported", "warning", 2000);
    });
  } else {
    document.exitFullscreen();
  }
}

// Make functions globally available
window.searchByMLSCode = searchByMLSCode;
window.clearSearch = clearSearch;
window.loadMLSPoints = loadMLSPoints;
window.selectMLSCode = selectMLSCode;
window.selectMLSPointFromTable = selectMLSPointFromTable;
window.showMLSDetailsFromPopup = showMLSDetailsFromPopup;
window.showMLSDetailsFromMarker = showMLSDetailsFromMarker;
window.downloadPDF = downloadPDF;
window.previewPDF = previewPDF;
window.clearMapAndDetails = clearMapAndDetails;
window.resetMapView = resetMapView;
window.toggleFullscreen = toggleFullscreen;
window.showMLSDetails = showMLSDetails;