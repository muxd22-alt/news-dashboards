export const EVENT_TYPES = [
  "wedding",
  "engagement",
  "corporate",
  "birthday",
  "graduation",
  "exhibition",
  "c_venues",
  "rest_houses",
  "c_productive_families",
  "c_catering_hospitality",
  "buffet",
  "banquets",
  "coffee_servers",
  "c_equipment_decoration",
  "c_logistics_organization",
  "security_guards",
  "c_entertainment",
  "c_printing_invitations",
  "dress_design",
  "hairdressers",
  "women_salons"
];

export const MENU_CATEGORIES = [
  {
    id: "c_venues",
    services: ["s_wedding_halls", "s_hotel_halls", "s_rest_houses", "s_chalets_majlis", "s_farms_camps", "s_coworking_spaces"]
  },
  {
    id: "c_productive_families",
    services: ["s_home_buffets", "s_sweets_bakery", "s_giveaways_gifts", "s_pantry_spices"]
  },
  {
    id: "c_catering_hospitality",
    services: ["s_catering_companies", "s_food_trucks", "s_coffee_tea", "s_specialized_carts"]
  },
  {
    id: "c_equipment_decoration",
    services: ["s_flower_arrangement", "s_furniture_rental", "s_koshas_stages", "s_lighting_sound"]
  },
  {
    id: "c_logistics_organization",
    services: ["s_event_organizers", "s_photography_videography", "s_security_organization", "s_valet_parking"]
  },
  {
    id: "c_entertainment",
    services: ["s_traditional_bands", "s_dj", "s_children_games"]
  },
  {
    id: "c_printing_invitations",
    services: ["s_electronic_invitations", "s_printed_materials"]
  }
];

// Combine all services into one flat list if needed
export const ALL_SERVICES_FLAT = MENU_CATEGORIES.flatMap(c => c.services);
