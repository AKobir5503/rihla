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
  lost:       { label: "Lost",       points: 0,   blurb: "Not a valid answer" },
};
export const RANK_ORDER = ["noor", "hidden_gem", "scholar", "pathfinder", "traveler", "footstep", "lost"];

// An answer at or above this rank on EVERY question unlocks the special final stop.
export const SPECIAL_MIN_RANK = "hidden_gem";

// Journey stops. `at` is the share of the maximum possible score needed to reach
// the stop (0.5 = half of max). The `special` stop ignores points and is reached
// only by the rule above.
export const ROUTES = {
  masjids: [
    { name: "GT Reflection Room", place: "Georgia Tech", at: 0 },
    { name: "Al Farooq Masjid", place: "Atlanta", at: 0.08 },
    { name: "Islamic Center of Washington", place: "Washington, DC", at: 0.18 },
    { name: "Mother Mosque of America", place: "Cedar Rapids, IA", at: 0.28 },
    { name: "Süleymaniye Mosque", place: "Istanbul", at: 0.40 },
    { name: "Al-Azhar Mosque", place: "Cairo", at: 0.52 },
    { name: "Umayyad Mosque", place: "Damascus", at: 0.64 },
    { name: "Masjid al-Aqsa", place: "Jerusalem", at: 0.76 },
    { name: "Madinah & Makkah", place: "Only for all Hidden Gem+ runs", special: true },
  ],
  campus: [
    { name: "Reflection Room", place: "Student Center", at: 0 },
    { name: "Tech Green", place: "", at: 0.10 },
    { name: "Clough Commons", place: "", at: 0.22 },
    { name: "Tech Tower", place: "", at: 0.36 },
    { name: "Bobby Dodd Stadium", place: "", at: 0.50 },
    { name: "Tech Square", place: "", at: 0.64 },
    { name: "Kendeda Building", place: "", at: 0.76 },
    { name: "The Campanile", place: "Only for all Hidden Gem+ runs", special: true },
  ],
};

// Default seconds per question (each game can override it in the dashboard).
export const DEFAULT_TIMER_SECONDS = 20;
