type VehicleCatalog = Record<string, Record<string, string[]>>;

const createModels = (models: string[], engines: string[]) =>
  Object.fromEntries(models.map((model) => [model, engines])) as Record<string, string[]>;

export const vehicleCatalog: VehicleCatalog = {
  Acura: createModels(["ILX", "Integra", "MDX", "NSX", "RDX", "RLX", "TLX", "TSX", "ZDX"], ["2.0L I4", "2.4L I4", "3.0L V6", "3.5L V6"]),
  Audi: createModels(["A3", "A4", "A5", "A6", "A7", "A8", "e-tron", "Q3", "Q5", "Q7", "Q8", "RS5", "S4", "TT"], ["2.0L I4", "3.0L V6", "4.0L V8"]),
  BMW: createModels(["2 Series", "3 Series", "4 Series", "5 Series", "7 Series", "M3", "M4", "X1", "X3", "X5", "X7", "Z4"], ["2.0L I4", "3.0L I6", "4.4L V8"]),
  Buick: createModels(["Enclave", "Encore", "Encore GX", "Envision", "Envista", "LaCrosse"], ["1.2L I3", "1.3L I3", "2.0L I4", "3.6L V6"]),
  Cadillac: createModels(["ATS", "CT4", "CT5", "CT6", "Escalade", "LYRIQ", "SRX", "XT4", "XT5", "XT6"], ["2.0L I4", "3.0L I6", "3.6L V6", "6.2L V8"]),
  Chevrolet: createModels(["Blazer", "Camaro", "Colorado", "Corvette", "Cruze", "Equinox", "Express", "Impala", "Malibu", "Silverado 1500", "Silverado 2500HD", "Suburban", "Tahoe", "Trailblazer", "Traverse", "Trax"], ["1.4L I4", "1.5L I4", "2.0L I4", "2.7L I4", "3.6L V6", "5.3L V8", "6.2L V8", "6.6L V8"]),
  Chrysler: createModels(["200", "300", "Pacifica", "PT Cruiser", "Sebring", "Town & Country", "Voyager"], ["2.4L I4", "3.6L V6", "5.7L V8"]),
  Dodge: createModels(["Avenger", "Challenger", "Charger", "Dakota", "Durango", "Grand Caravan", "Hornet", "Journey", "Ram 1500"], ["2.0L I4", "2.4L I4", "3.6L V6", "5.7L V8", "6.2L V8"]),
  Ford: createModels(["Bronco", "Bronco Sport", "C-Max", "Edge", "Escape", "Excursion", "Expedition", "Explorer", "F-150", "F-250 Super Duty", "F-350 Super Duty", "Fiesta", "Flex", "Focus", "Fusion", "Maverick", "Mustang", "Ranger", "Taurus", "Transit"], ["1.5L I3", "1.5L I4", "2.0L I4", "2.3L I4", "2.7L V6", "3.5L V6", "5.0L V8", "6.7L V8 Diesel"]),
  GMC: createModels(["Acadia", "Canyon", "Savana", "Sierra 1500", "Sierra 2500HD", "Terrain", "Yukon", "Yukon XL"], ["1.5L I4", "2.7L I4", "3.6L V6", "5.3L V8", "6.2L V8", "6.6L V8 Diesel"]),
  Honda: createModels(["Accord", "Civic", "CR-V", "CR-Z", "Crosstour", "Fit", "HR-V", "Insight", "Odyssey", "Passport", "Pilot", "Ridgeline"], ["1.5L I4", "2.0L I4", "2.4L I4", "3.5L V6"]),
  Hyundai: createModels(["Accent", "Elantra", "Genesis", "Ioniq", "Kona", "Palisade", "Santa Cruz", "Santa Fe", "Sonata", "Tucson", "Veloster", "Venue"], ["1.6L I4", "2.0L I4", "2.5L I4", "3.8L V6"]),
  Infiniti: createModels(["G37", "Q50", "Q60", "QX50", "QX60", "QX80"], ["2.0L I4", "3.0L V6", "3.5L V6", "5.6L V8"]),
  Jeep: createModels(["Cherokee", "Compass", "Gladiator", "Grand Cherokee", "Liberty", "Patriot", "Renegade", "Wagoneer", "Wrangler"], ["1.3L I4", "2.0L I4", "2.4L I4", "3.6L V6", "5.7L V8", "6.4L V8"]),
  Kia: createModels(["Carnival", "Forte", "K5", "Niro", "Optima", "Rio", "Seltos", "Sorento", "Soul", "Sportage", "Stinger", "Telluride"], ["1.6L I4", "2.0L I4", "2.5L I4", "3.3L V6", "3.8L V6"]),
  Lexus: createModels(["ES", "GS", "GX", "IS", "LC", "LS", "LX", "NX", "RC", "RX", "UX"], ["2.0L I4", "2.5L I4", "3.5L V6", "4.6L V8", "5.0L V8"]),
  Lincoln: createModels(["Aviator", "Corsair", "MKC", "MKS", "MKT", "MKX", "MKZ", "Nautilus", "Navigator"], ["2.0L I4", "2.3L I4", "2.7L V6", "3.0L V6", "3.5L V6"]),
  Mazda: createModels(["CX-3", "CX-30", "CX-5", "CX-50", "CX-9", "CX-90", "Mazda3", "Mazda6", "MX-5 Miata"], ["2.0L I4", "2.5L I4", "3.3L I6"]),
  "Mercedes-Benz": createModels(["A-Class", "C-Class", "CLA", "CLS", "E-Class", "G-Class", "GLA", "GLB", "GLE", "GLS", "Metris", "S-Class", "Sprinter"], ["2.0L I4", "3.0L I6", "4.0L V8"]),
  Mercury: createModels(["Grand Marquis", "Milan", "Mariner", "Mountaineer"], ["2.3L I4", "3.0L V6", "4.0L V6", "4.6L V8"]),
  MINI: createModels(["Clubman", "Convertible", "Cooper", "Countryman", "Hardtop"], ["1.5L I3", "2.0L I4"]),
  Mitsubishi: createModels(["Eclipse Cross", "Galant", "Lancer", "Mirage", "Outlander", "Outlander Sport"], ["1.2L I3", "1.5L I4", "2.0L I4", "2.4L I4", "3.0L V6"]),
  Nissan: createModels(["370Z", "Altima", "Armada", "Frontier", "Kicks", "Leaf", "Maxima", "Murano", "Pathfinder", "Rogue", "Sentra", "Titan", "Versa"], ["1.6L I4", "2.0L I4", "2.5L I4", "3.5L V6", "5.6L V8"]),
  Pontiac: createModels(["G6", "G8", "Grand Am", "Grand Prix", "Torrent", "Vibe"], ["1.8L I4", "2.4L I4", "3.5L V6", "3.6L V6", "5.3L V8", "6.0L V8"]),
  Porsche: createModels(["911", "Boxster", "Cayenne", "Cayman", "Macan", "Panamera", "Taycan"], ["2.0L I4", "2.9L V6", "3.0L H6", "4.0L H6", "4.0L V8"]),
  Ram: createModels(["1500", "2500", "3500", "ProMaster", "ProMaster City"], ["2.4L I4", "3.6L V6", "5.7L V8", "6.4L V8", "6.7L I6 Diesel"]),
  Saturn: createModels(["Aura", "Ion", "Outlook", "Vue"], ["2.2L I4", "2.4L I4", "3.5L V6", "3.6L V6"]),
  Scion: createModels(["FR-S", "iA", "iM", "tC", "xB", "xD"], ["1.5L I4", "1.8L I4", "2.0L H4", "2.4L I4"]),
  Subaru: createModels(["Ascent", "Baja", "BRZ", "Crosstrek", "Forester", "Impreza", "Legacy", "Outback", "Tribeca", "WRX"], ["2.0L H4", "2.4L H4", "2.5L H4", "3.0L H6", "3.6L H6"]),
  Tesla: createModels(["Model 3", "Model S", "Model X", "Model Y"], ["Single Motor Electric", "Dual Motor Electric", "Tri Motor Electric"]),
  Toyota: createModels(["4Runner", "Avalon", "Camry", "Corolla", "Highlander", "Land Cruiser", "Prius", "RAV4", "Sequoia", "Sienna", "Tacoma", "Tundra", "Venza", "Yaris"], ["1.8L I4", "2.0L I4", "2.5L I4", "3.5L V6", "4.0L V6", "5.7L V8"]),
  Volkswagen: createModels(["Arteon", "Atlas", "Beetle", "CC", "Golf", "GTI", "Jetta", "Passat", "Taos", "Tiguan"], ["1.4L I4", "1.5L I4", "2.0L I4", "3.6L V6"]),
  Volvo: createModels(["C30", "S60", "S90", "V60", "V90", "XC40", "XC60", "XC90"], ["2.0L I4", "2.5L I5", "3.0L I6"]),
};

export const vehicleMakes = Object.keys(vehicleCatalog).sort((a, b) =>
  a.localeCompare(b),
);
