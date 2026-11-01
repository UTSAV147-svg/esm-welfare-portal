/**
 * ==============================================================================
 * VeerSeva - Scrapers & Benefits Orchestrator Service
 * Simulates real-time scrapers for SPARSH, ECHS, CSD AFD, and DGR/KSB
 * Maintains last-updated timestamps and handles scheduled background updates
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// Load initial mock datasets
const sparshMock = require('../mocks/sparshPensionMock.json');
const echsMock = require('../mocks/echsPolyclinicsMock.json');
const csdMock = require('../mocks/csdAfdMock.json');
const dgrMock = require('../mocks/dgrJobsMock.json');

// In-memory cache with metadata
const cache = {
  sparsh: { data: sparshMock, lastUpdated: new Date().toISOString(), status: 'HEALTHY' },
  echs: { data: echsMock, lastUpdated: new Date().toISOString(), status: 'HEALTHY' },
  csd: { data: csdMock, lastUpdated: new Date().toISOString(), status: 'HEALTHY' },
  dgr: { data: dgrMock, lastUpdated: new Date().toISOString(), status: 'HEALTHY' }
};

/**
 * Get Pension / SPARSH Details for a service number
 */
function getPensionData(serviceNumber) {
  return {
    ...cache.sparsh.data.sparsh_account,
    last_scraped_at: cache.sparsh.lastUpdated
  };
}

/**
 * Get ECHS Polyclinics and Empaneled Hospitals with query filters
 */
function getEchsData({ state = null, city = null, speciality = null, search = null } = {}) {
  let polyclinics = [...cache.echs.data.polyclinics];
  let hospitals = [...cache.echs.data.empaneled_hospitals];

  if (state) {
    polyclinics = polyclinics.filter(p => p.state.toLowerCase() === state.toLowerCase());
    hospitals = hospitals.filter(h => h.state.toLowerCase() === state.toLowerCase());
  }

  if (city) {
    polyclinics = polyclinics.filter(p => p.district.toLowerCase() === city.toLowerCase());
    hospitals = hospitals.filter(h => h.city.toLowerCase() === city.toLowerCase());
  }

  if (speciality) {
    hospitals = hospitals.filter(h => 
      h.specialities.some(s => s.toLowerCase().includes(speciality.toLowerCase()))
    );
  }

  if (search) {
    const term = search.toLowerCase();
    polyclinics = polyclinics.filter(p => 
      p.name.toLowerCase().includes(term) || p.address.toLowerCase().includes(term)
    );
    hospitals = hospitals.filter(h => 
      h.name.toLowerCase().includes(term) || h.address.toLowerCase().includes(term)
    );
  }

  return {
    regional_centers: cache.echs.data.regional_centers,
    polyclinics,
    empaneled_hospitals: hospitals,
    total_polyclinics: polyclinics.length,
    total_hospitals: hospitals.length,
    last_scraped_at: cache.echs.lastUpdated
  };
}

/**
 * Get CSD AFD Portal Catalog with category, search, and entitlement filtering
 */
function getCsdCatalog({ category = null, rankRole = null, search = null } = {}) {
  let products = [...cache.csd.data.products];

  if (category) {
    products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  if (rankRole) {
    const normalizedRole = rankRole.toUpperCase();
    products = products.filter(p => p.entitlement_eligible.includes(normalizedRole));
  }

  if (search) {
    const term = search.toLowerCase();
    products = products.filter(p => 
      p.name.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term)
    );
  }

  return {
    categories: cache.csd.data.afd_categories,
    entitlement_rules: cache.csd.data.entitlement_rules,
    products,
    total_products: products.length,
    last_scraped_at: cache.csd.lastUpdated
  };
}

/**
 * Get DGR Corporate Jobs & PMSS Scholarship status
 */
function getDgrResettlementData() {
  return {
    corporate_jobs: cache.dgr.data.dgr_corporate_jobs,
    pmss_scholarship: cache.dgr.data.pmss_scholarship_status,
    last_scraped_at: cache.dgr.lastUpdated
  };
}

/**
 * Trigger scraper refresh (invoked via Cron or Admin dashboard)
 */
async function refreshScrapers(source = 'ALL') {
  const now = new Date().toISOString();

  if (source === 'ALL' || source === 'SPARSH') {
    cache.sparsh.lastUpdated = now;
    cache.sparsh.status = 'HEALTHY';
  }
  if (source === 'ALL' || source === 'ECHS') {
    cache.echs.lastUpdated = now;
    cache.echs.status = 'HEALTHY';
  }
  if (source === 'ALL' || source === 'CSD') {
    cache.csd.lastUpdated = now;
    cache.csd.status = 'HEALTHY';
  }
  if (source === 'ALL' || source === 'DGR') {
    cache.dgr.lastUpdated = now;
    cache.dgr.status = 'HEALTHY';
  }

  console.log(`[Scraper Engine] Refreshed external datasets for source: ${source} at ${now}`);

  return getScraperHealthStatus();
}

/**
 * Get Scraper Health Status for Admin dashboard
 */
function getScraperHealthStatus() {
  return {
    sparsh: {
      name: 'SPARSH / PCDA Pension Portal Scraper',
      status: cache.sparsh.status,
      lastUpdated: cache.sparsh.lastUpdated,
      targetEndpoint: 'https://sparsh.defencepension.gov.in',
      interval: 'Every 6 Hours'
    },
    echs: {
      name: 'ECHS Polyclinics & Empaneled Hospitals Scraper',
      status: cache.echs.status,
      lastUpdated: cache.echs.lastUpdated,
      targetEndpoint: 'https://echs.gov.in',
      interval: 'Every 12 Hours'
    },
    csd: {
      name: 'CSD AFD Online Portal Scraper',
      status: cache.csd.status,
      lastUpdated: cache.csd.lastUpdated,
      targetEndpoint: 'https://afd.csdindia.gov.in',
      interval: 'Every 4 Hours'
    },
    dgr: {
      name: 'DGR Resettlement & KSB PMSS Scraper',
      status: cache.dgr.status,
      lastUpdated: cache.dgr.lastUpdated,
      targetEndpoint: 'https://dgrindia.gov.in / https://ksb.gov.in',
      interval: 'Every 6 Hours'
    }
  };
}

module.exports = {
  getPensionData,
  getEchsData,
  getCsdCatalog,
  getDgrResettlementData,
  refreshScrapers,
  getScraperHealthStatus
};
