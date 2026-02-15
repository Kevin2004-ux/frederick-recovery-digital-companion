// app/backend/src/services/plan/contentLibrary.ts

export type ModuleDefinition = {
  id: string;
  type: 'education' | 'task' | 'tracking' | 'milestone';
  title: string;
  text: string;
  videoUrl?: string | null; // URL for your future animations (YouTube/Vimeo)
  frequency?: string; // e.g., "Daily", "Every 4 hours"
  redFlags?: string[]; // Specific warnings for this module
};

export const CONTENT_LIBRARY: Record<string, ModuleDefinition> = {
  // --- A. PAIN & SYMPTOM TRACKING ---
  track_pain_movement: {
    id: "track_pain_movement",
    type: "tracking",
    title: "Daily Symptom Check-in",
    text: "Please rate your pain level (0-10) and check for any signs of infection. This helps us catch issues early.",
    frequency: "Daily",
    redFlags: ["Fever > 101°F", "Uncontrollable Pain", "Yellow/Green Discharge"]
  },

  // --- B. WOUND CARE (The "Gauze" Request) ---
  // Source: Mayo Clinic Post-Op Care Guide
  education_wound_care_basic: {
    id: "education_wound_care_basic",
    type: "education",
    title: "Keeping Your Incision Clean",
    text: "Your incision is healing. Keep the area clean and dry. Do not scrub the wound directly. Pat it dry gently after showering if permitted.",
    videoUrl: null, // Future: "Animation: How to shower safely"
    redFlags: ["Area feels hot to touch", "Bad smell coming from wound"]
  },
  
  task_gauze_change: {
    id: "task_gauze_change",
    type: "task",
    title: "Change Your Dressing",
    text: "1. Wash your hands thoroughly.\n2. Carefully peel back the old tape.\n3. Check the wound for signs of infection.\n4. Apply a fresh, sterile gauze pad from your box.\n5. Tape purely on skin, not on the wound.",
    videoUrl: null, // Future: "Animation: Changing the Gauze"
    frequency: "As needed (usually daily)"
  },

  education_wound_care_sutures: {
    id: "education_wound_care_sutures",
    type: "education",
    title: "Caring for Sutures/Staples",
    text: "You have stitches or staples closing your wound. These will need to be removed by your doctor (usually around Day 10-14). Do not pick at them.",
    videoUrl: null 
  },

  // --- C. SWELLING & PAIN MANAGEMENT (The "Ice" Request) ---
  // Source: AAOS & R.I.C.E. Protocol
  education_ice_knee: {
    id: "education_ice_knee",
    type: "task",
    title: "Ice Therapy (20-30 Mins)",
    text: "Apply the ice pack from your box to the surgical area.\n\n• DURATION: 20-30 minutes.\n• SAFETY: Always put a thin cloth between the ice and your skin to prevent frostbite.\n• FREQUENCY: Every 2-3 hours for the first 3 days.",
    videoUrl: null, // Future: "Animation: How to Ice the Knee"
    redFlags: ["Skin turns white/hard (Frostbite risk)"]
  },

  education_elevation: {
    id: "education_elevation",
    type: "education",
    title: "Elevate to Reduce Swelling",
    text: "Keep your operated leg elevated above the level of your heart. This uses gravity to drain fluid away from your knee/foot and significantly reduces pain.",
    videoUrl: null, // Future: "Animation: Correct Elevation vs. Incorrect"
  },

  // --- D. MOBILITY & ACTIVITY ---
  education_mobility_crutches: {
    id: "education_mobility_crutches",
    type: "education",
    title: "Using Your Crutches",
    text: "Ensure you are using your crutches correctly to avoid under-arm pain. Support your weight with your hands, not your armpits.",
    videoUrl: null, // Future: "Animation: Walking with Crutches"
  },

  education_mobility_walking: {
    id: "education_mobility_walking",
    type: "education",
    title: "Weight Bearing as Tolerated",
    text: "You may begin to put weight on your leg as comfort allows. Start with a normal heel-to-toe gait pattern, even if using crutches for balance.",
    videoUrl: null
  },

  // --- E. MILESTONES ---
  milestone_suture_removal: {
    id: "milestone_suture_removal",
    type: "milestone",
    title: "Milestone: Suture Removal",
    text: "This week is typically when stitches or staples are removed. Ensure you have an appointment scheduled with your clinic.",
    videoUrl: null
  },
  
  milestone_driving: {
    id: "milestone_driving",
    type: "milestone",
    title: "Driving Assessment",
    text: "Do not drive until you are off all narcotic pain medication and have full braking reaction time. Discuss with your doctor.",
    videoUrl: null
  }
};