// Illustrative macro snapshot values — approximate, for gameplay purposes.
// Not live market data. Swap this out with a real feed if you want it accurate to the day.
const DATA = [
  { name: "United States",  region: "N. America",  status: "DM",       fx: "Free Float",    gdp: 2.0,  inf: 2.7,  rate: 4.25, ca: -3.5, debt: 122 },
  { name: "United Kingdom", region: "Europe",       status: "DM",       fx: "Free Float",    gdp: 1.0,  inf: 2.5,  rate: 4.00, ca: -3.0, debt: 100 },
  { name: "Germany",        region: "Europe",       status: "DM",       fx: "Free Float",    gdp: 0.3,  inf: 2.2,  rate: 2.25, ca:  5.5, debt: 63  },
  { name: "Japan",          region: "Asia",         status: "DM",       fx: "Free Float",    gdp: 0.8,  inf: 2.3,  rate: 0.50, ca:  4.0, debt: 235 },
  { name: "China",          region: "Asia",         status: "EM",       fx: "Managed Float", gdp: 4.8,  inf: 0.5,  rate: 3.00, ca:  1.8, debt: 90  },
  { name: "India",          region: "Asia",         status: "EM",       fx: "Managed Float", gdp: 6.5,  inf: 5.0,  rate: 6.00, ca: -1.0, debt: 82  },
  { name: "Brazil",         region: "S. America",   status: "EM",       fx: "Free Float",    gdp: 2.5,  inf: 4.5,  rate: 12.25,ca: -2.0, debt: 78  },
  { name: "Mexico",         region: "N. America",   status: "EM",       fx: "Free Float",    gdp: 1.5,  inf: 4.2,  rate: 9.50, ca: -0.5, debt: 52  },
  { name: "South Africa",   region: "Africa",       status: "EM",       fx: "Free Float",    gdp: 1.0,  inf: 4.8,  rate: 7.50, ca: -1.5, debt: 75  },
  { name: "Turkey",         region: "Europe",       status: "EM",       fx: "Free Float",    gdp: 3.0,  inf: 38.0, rate: 46.00,ca: -1.5, debt: 30  },
  { name: "Indonesia",      region: "Asia",         status: "EM",       fx: "Free Float",    gdp: 5.0,  inf: 2.5,  rate: 6.00, ca: -0.5, debt: 39  },
  { name: "South Korea",    region: "Asia",         status: "DM",       fx: "Free Float",    gdp: 2.0,  inf: 2.0,  rate: 2.75, ca:  4.5, debt: 55  },
  { name: "Australia",      region: "Oceania",      status: "DM",       fx: "Free Float",    gdp: 1.5,  inf: 2.4,  rate: 3.85, ca: -1.0, debt: 45  },
  { name: "Canada",         region: "N. America",   status: "DM",       fx: "Free Float",    gdp: 1.3,  inf: 2.0,  rate: 2.75, ca: -1.0, debt: 68  },
  { name: "Switzerland",    region: "Europe",       status: "DM",       fx: "Free Float",    gdp: 1.2,  inf: 0.5,  rate: 0.00, ca:  6.0, debt: 38  },
  { name: "Nigeria",        region: "Africa",       status: "Frontier", fx: "Free Float",    gdp: 3.5,  inf: 24.0, rate: 27.50,ca:  1.0, debt: 50  },
  { name: "Egypt",          region: "Africa",       status: "Frontier", fx: "Managed Float", gdp: 4.0,  inf: 15.0, rate: 25.00,ca: -3.0, debt: 90  },
  { name: "Saudi Arabia",   region: "Middle East",  status: "EM",       fx: "Pegged",        gdp: 3.0,  inf: 2.0,  rate: 5.50, ca:  2.0, debt: 28  },
  { name: "Argentina",      region: "S. America",   status: "EM",       fx: "Managed Float", gdp: 4.5,  inf: 40.0, rate: 35.00,ca:  1.0, debt: 85  },
  { name: "Russia",         region: "Europe",       status: "EM",       fx: "Managed Float", gdp: 1.5,  inf: 9.0,  rate: 20.00,ca:  3.0, debt: 15  }
];

if (typeof module !== "undefined") module.exports = DATA;
