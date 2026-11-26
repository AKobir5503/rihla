// ---------------------------------------------------------------------------
// Rihla configuration. This is the only file most officers ever need to edit.
// ---------------------------------------------------------------------------

// Leave both blank to run in DEMO mode (sample questions, saved in your browser
// only, no accounts, no AI). Fill them in from Supabase -> Project Settings -> API
// to go live. The anon key is safe to publish; it only allows what the database
// rules in supabase/schema.sql allow.
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

// Pick which journey players travel: "masjids" or "campus".
export const ROUTE_NAME = "masjids";

// Rank ladder. Points per answer. Change names or points freely.
export const RANKS = {
  noor:       { label: "Noor",       points: 100, blurb: "The newsletter answer" },
  hidden_gem: { label: "Hidden Gem", points: 80,  blurb: "Almost nobody thinks of this" },
  scholar:    { label: "Scholar",    points: 55,  blurb: "Rare" },
  pathfinder: { label: "Pathfinder", points: 35,  blurb: "Uncommon" },
  traveler:   { label: "Traveler",   points: 20,  blurb: "Fairly common" },
  footstep:   { label: "Footstep",   points: 10,  blurb: "What most people say" },
  lost:       { label: "Lost",       points: 0,   blurb: "Time ran out before a valid answer" },
};
export const RANK_ORDER = ["noor", "hidden_gem", "scholar", "pathfinder", "traveler", "footstep", "lost"];

// An answer at or above this rank on EVERY question unlocks the special final stop.
export const SPECIAL_MIN_RANK = "hidden_gem";

// Journey stops. `at` = share of the maximum possible score needed to reach the stop
// (0.5 = half of max). Every point is 10 km of travel. `zone` sets the scenery after the
// stop (campus, city, usa, ocean, hills, desert, levant, holy) and `sprite` its landmark
// (gttower, masjid, tallmasjid, smallmasjid, bigmasjid, goldendome, greendome, building, spire).
// The `special` stop ignores points: only runs where every answer is Hidden Gem or better
// get through the gate to it.
export const KM_PER_POINT = 10;
export const ROUTES = {
  masjids: [
    { name: "GT Reflection Room", place: "Georgia Tech", at: 0, zone: "campus", zoneLabel: "Georgia Tech campus", sprite: "gttower" },
    { name: "Al Farooq Masjid", place: "Atlanta", at: 0.08, zone: "city", zoneLabel: "Atlanta", sprite: "masjid" },
    { name: "Islamic Center of Washington", place: "Washington, DC", at: 0.18, zone: "usa", zoneLabel: "Across America", sprite: "tallmasjid" },
    { name: "Mother Mosque of America", place: "Cedar Rapids, IA", at: 0.28, zone: "ocean", zoneLabel: "The Atlantic", sprite: "smallmasjid" },
    { name: "Süleymaniye Mosque", place: "Istanbul", at: 0.40, zone: "hills", zoneLabel: "Anatolia", sprite: "bigmasjid" },
    { name: "Al-Azhar Mosque", place: "Cairo", at: 0.52, zone: "desert", zoneLabel: "Sinai desert", sprite: "masjid" },
    { name: "Umayyad Mosque", place: "Damascus", at: 0.64, zone: "levant", zoneLabel: "The Levant", sprite: "bigmasjid" },
    { name: "Masjid al-Aqsa", place: "Jerusalem", at: 0.76, zone: "levant", zoneLabel: "The Levant", sprite: "goldendome" },
    { name: "Madinah & Makkah", place: "Only for all Hidden Gem+ runs", zone: "holy", zoneLabel: "The Hijaz", sprite: "greendome", special: true },
  ],
  campus: [
    { name: "Reflection Room", place: "Student Center", at: 0, zone: "campus", zoneLabel: "West campus", sprite: "building" },
    { name: "Tech Green", place: "", at: 0.10, zone: "campus", zoneLabel: "Tech Green", sprite: "building" },
    { name: "Clough Commons", place: "", at: 0.22, zone: "campus", zoneLabel: "Central campus", sprite: "building" },
    { name: "Tech Tower", place: "", at: 0.36, zone: "city", zoneLabel: "North Ave", sprite: "gttower" },
    { name: "Bobby Dodd Stadium", place: "", at: 0.50, zone: "city", zoneLabel: "Game day", sprite: "building" },
    { name: "Tech Square", place: "", at: 0.64, zone: "city", zoneLabel: "Midtown", sprite: "building" },
    { name: "Kendeda Building", place: "", at: 0.76, zone: "campus", zoneLabel: "Eco Commons", sprite: "building" },
    { name: "The Campanile", place: "Only for all Hidden Gem+ runs", zone: "holy", zoneLabel: "Campanile at night", sprite: "spire", special: true },
  ],
};

// Default seconds per question (each game can override it in the dashboard).
export const DEFAULT_TIMER_SECONDS = 20;
