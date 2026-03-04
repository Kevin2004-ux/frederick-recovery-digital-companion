// app/backend/src/services/plan/contentLibrary.ts

export type ModuleDefinition = {
  id: string;
  type: "education" | "task" | "tracking" | "milestone";
  title: string;
  text: string;
  videoUrl?: string | null;
  frequency?: string;
  redFlags?: string[];
  requiredBoxItems?: string[];
  medlineSearchTags?: string[];
};

export const CONTENT_LIBRARY: Record<string, ModuleDefinition> = {
  // =========================================================
  // CORE RECOVERY / GENERAL
  // =========================================================
  education_recovery_kit_overview: {
    id: "education_recovery_kit_overview",
    type: "education",
    title: "What Is in Your Recovery Kit",
    text: "Your recovery kit may include sterile gauze pads, an instant cold pack, hypoallergenic medical tape, sanitizing wipes, gloves, scar gel, a thank-you card, and a recovery flyer. Use only the items your clinic told you are appropriate for your recovery.",
    videoUrl: null,
    requiredBoxItems: ["gauze", "icepack", "tape", "wipes", "gloves", "scar_gel", "thank_you_card", "recovery_flyer"],
    medlineSearchTags: ["recovery after surgery", "home care after surgery"],
  },

  track_pain_movement: {
    id: "track_pain_movement",
    type: "tracking",
    title: "Daily Symptom Check-In",
    text: "Rate your pain and note whether movement made symptoms worse today. Also check for warning signs such as fever, worsening redness, new drainage, or pain that is getting harder to control.",
    frequency: "Daily",
    redFlags: ["Fever over 101°F", "Pain rapidly worsening", "Yellow or green drainage", "Redness spreading"],
    medlineSearchTags: ["postoperative pain", "surgical wound infection"],
  },

  track_pain_daily: {
    id: "track_pain_daily",
    type: "tracking",
    title: "Daily Pain Log",
    text: "Record your pain level for the day and note whether swelling, redness, or drainage changed compared with yesterday.",
    frequency: "Daily",
    redFlags: ["Fever over 101°F", "Uncontrolled pain", "Rapid increase in swelling", "New drainage"],
    medlineSearchTags: ["postoperative pain", "recovery after surgery"],
  },

  milestone_follow_up_prep: {
    id: "milestone_follow_up_prep",
    type: "milestone",
    title: "Prepare for Follow-Up",
    text: "Make sure your follow-up visit is scheduled if needed. Write down questions about pain, swelling, wound healing, activity, work, or anything that feels unclear.",
    videoUrl: null,
    medlineSearchTags: ["follow up after surgery", "questions for post op visit"],
  },

  // =========================================================
  // WOUND CARE / INCISION
  // =========================================================
  education_wound_care_basic: {
    id: "education_wound_care_basic",
    type: "education",
    title: "Keeping Your Incision Clean",
    text: "Keep the incision clean and dry. Do not scrub the area. If showering is allowed, let water run gently over the site and pat dry. Avoid soaking the wound unless your clinic says it is okay.",
    videoUrl: null,
    redFlags: ["Area feels hot", "Bad odor from incision", "Increasing redness", "Wound opening"],
    medlineSearchTags: ["surgical wound care", "incision care"],
  },

  education_wound_care_sutures: {
    id: "education_wound_care_sutures",
    type: "education",
    title: "Caring for Sutures or Staples",
    text: "Do not pick at sutures or staples. Keep the area clean and dry, and follow your clinic’s instructions for dressing care and bathing. Removal is often discussed at a follow-up visit.",
    videoUrl: null,
    redFlags: ["Staples pulling through skin", "Sudden wound opening", "New drainage", "Redness spreading"],
    medlineSearchTags: ["sutures care", "staples after surgery"],
  },

  task_gauze_change: {
    id: "task_gauze_change",
    type: "task",
    title: "Change Your Dressing",
    text: "Wash your hands, remove the old dressing carefully, inspect the area, place a fresh sterile gauze pad, and secure it gently with medical tape if your care plan calls for a dressing change.",
    videoUrl: null,
    frequency: "As directed",
    requiredBoxItems: ["gloves", "gauze", "tape", "wipes"],
    redFlags: ["Drainage increasing", "Foul smell", "Bleeding that does not stop", "Skin irritation worsening"],
    medlineSearchTags: ["changing surgical dressing", "sterile dressing change"],
  },

  task_check_incision: {
    id: "task_check_incision",
    type: "task",
    title: "Inspect Incision Site",
    text: "Look at the incision today and check for redness, swelling, drainage, odor, or separation of the wound edges. Compare it with yesterday if possible.",
    videoUrl: null,
    frequency: "Daily",
    redFlags: ["Redness spreading", "Pus-like drainage", "Wound opening", "Fever over 101°F"],
    medlineSearchTags: ["signs of wound infection", "incision check after surgery"],
  },

  task_scar_care: {
    id: "task_scar_care",
    type: "task",
    title: "Scar Care",
    text: "Only begin scar-care products after the incision is fully closed and your clinic has said it is appropriate. Apply products gently to intact skin only.",
    videoUrl: null,
    frequency: "As directed after the incision is fully closed",
    requiredBoxItems: ["scar_gel"],
    redFlags: ["Rash", "Burning", "Incision not fully closed"],
    medlineSearchTags: ["scar care after surgery", "healing surgical scar"],
  },

  // =========================================================
  // SWELLING / COMFORT
  // =========================================================
  education_ice_knee: {
    id: "education_ice_knee",
    type: "task",
    title: "Cold Therapy",
    text: "Use cold therapy for short sessions to help with swelling and discomfort. Place a cloth or barrier between the cold pack and your skin, and avoid prolonged direct contact.",
    videoUrl: null,
    frequency: "Short sessions as needed, especially early in recovery",
    requiredBoxItems: ["icepack"],
    redFlags: ["Skin turns pale, numb, or painful from cold exposure"],
    medlineSearchTags: ["cold therapy after surgery", "swelling after surgery"],
  },

  education_elevation: {
    id: "education_elevation",
    type: "education",
    title: "Elevate to Reduce Swelling",
    text: "If swelling is present, elevate the affected area when resting if your care team has told you that elevation is appropriate for your recovery.",
    videoUrl: null,
    medlineSearchTags: ["reduce swelling after surgery", "elevation after injury or surgery"],
  },

  sprain_rice_task: {
    id: "sprain_rice_task",
    type: "task",
    title: "Use the RICE Method",
    text: "To help a sprain or similar injury heal, follow the RICE steps: rest the joint, use cold therapy with a cloth barrier, use compression if your clinic recommended it, and elevate the area above heart level when possible.",
    videoUrl: null,
    frequency: "Several times daily in the early phase",
    requiredBoxItems: ["icepack"],
    redFlags: ["Pain getting much worse", "Numbness", "Toes or fingers changing color", "Unable to move the limb"],
    medlineSearchTags: ["RICE method", "sprain care"],
  },

  // =========================================================
  // MOBILITY / ORTHOPEDICS
  // =========================================================
  education_mobility_crutches: {
    id: "education_mobility_crutches",
    type: "education",
    title: "Using Your Crutches Safely",
    text: "Use your hands to support your weight rather than leaning through your armpits. Move carefully and follow any weight-bearing limits from your clinic.",
    videoUrl: null,
    medlineSearchTags: ["using crutches", "mobility after surgery"],
  },

  education_mobility_gentle: {
    id: "education_mobility_gentle",
    type: "education",
    title: "Gentle Movement",
    text: "Gentle movement may help reduce stiffness, but activity should match the limits given by your clinic. Stop and contact your care team if movement causes sudden worsening pain or other concerning symptoms.",
    videoUrl: null,
    medlineSearchTags: ["gentle movement after surgery", "prevent stiffness after surgery"],
  },

  education_mobility_walking: {
    id: "education_mobility_walking",
    type: "education",
    title: "Walking and Weight Bearing",
    text: "If your clinic has allowed it, begin walking carefully within your permitted limits and use assistive devices as instructed.",
    videoUrl: null,
    medlineSearchTags: ["walking after surgery", "weight bearing after surgery"],
  },

  hip_replacement_precautions: {
    id: "hip_replacement_precautions",
    type: "education",
    title: "Protecting Your New Hip",
    text: "Sit in firm chairs and avoid very low, soft seats that put your knees higher than your hips. Follow the movement precautions your clinic gave you and move slowly when getting up or sitting down.",
    videoUrl: null,
    redFlags: ["Calf pain", "Sudden chest pain", "Hip that suddenly feels out of place"],
    medlineSearchTags: ["hip replacement recovery", "hip precautions after surgery"],
  },

  hip_replacement_milestone: {
    id: "hip_replacement_milestone",
    type: "milestone",
    title: "Looking Ahead: Hip Recovery Milestones",
    text: "Your clinic will guide your timeline, but many people gradually move from basic transfers and short walks toward more independence over the following weeks. Follow your surgeon and therapy team for the safest timing.",
    videoUrl: null,
    medlineSearchTags: ["hip replacement milestones"],
  },

  knee_replacement_task: {
    id: "knee_replacement_task",
    type: "task",
    title: "Daily Knee Recovery Routine",
    text: "Follow the exercises taught by your therapy team and move your knee as instructed. Safe, steady movement can help prevent stiffness. If compression stockings were prescribed, wear them as directed and smooth out wrinkles so they do not bunch up.",
    videoUrl: null,
    frequency: "Daily",
    redFlags: ["Calf pain", "Sudden shortness of breath", "Knee swelling rapidly worsening"],
    medlineSearchTags: ["knee replacement recovery", "compression stockings after surgery"],
  },

  spine_surgery_education: {
    id: "spine_surgery_education",
    type: "education",
    title: "Protecting Your Healing Spine",
    text: "Follow the BLT rule unless your clinic tells you otherwise: no bending, lifting, or twisting. Use your knees rather than bending at the waist, limit long sitting sessions, and walk gently as directed.",
    videoUrl: null,
    redFlags: ["New numbness or tingling", "Loss of bladder or bowel control", "Fever over 101°F", "Bad-smelling wound drainage"],
    medlineSearchTags: ["spinal fusion recovery", "laminectomy care"],
  },

  shoulder_surgery_task: {
    id: "shoulder_surgery_task",
    type: "task",
    title: "Managing Your Sling",
    text: "Keep your sling on as instructed and do not lift the arm away from your body unless your clinic approved a specific exercise. Move your wrist and hand as allowed to reduce stiffness.",
    videoUrl: null,
    frequency: "As directed",
    redFlags: ["Hand turns cool", "Hand turns blue", "Sudden severe pain", "New numbness"],
    medlineSearchTags: ["rotator cuff repair", "shoulder sling safety"],
  },

  cast_care_education: {
    id: "cast_care_education",
    type: "education",
    title: "Caring for Your Cast or Splint",
    text: "Keep the cast or splint dry. Do not put objects inside it to scratch your skin. If itching bothers you, try cool air from a hair dryer on a cool setting instead.",
    videoUrl: null,
    redFlags: ["Fingers or toes turn blue", "Numbness", "Severe swelling", "Cast gets soaked or damaged"],
    medlineSearchTags: ["cast care", "splint care"],
  },

  dvt_prevention_task: {
    id: "dvt_prevention_task",
    type: "task",
    title: "Keep Leg Blood Moving",
    text: "If your clinic recommended ankle pumps or compression stockings, use them as directed. Move your feet and ankles often while awake, and avoid sitting still for long periods if your recovery plan allows movement.",
    videoUrl: null,
    frequency: "Throughout the day",
    redFlags: ["Calf pain", "One leg swelling much more than the other", "Sudden chest pain", "Sudden shortness of breath"],
    medlineSearchTags: ["deep vein thrombosis prevention", "ankle pumps after surgery"],
  },

  // =========================================================
  // ABDOMINAL / PELVIC / UROLOGIC / GYNECOLOGIC
  // =========================================================
  appendectomy_education: {
    id: "appendectomy_education",
    type: "education",
    title: "Healing After Appendix Surgery",
    text: "It is common to feel tired after surgery. Start with simple foods if your stomach feels sensitive, drink fluids, and avoid lifting more than your clinic allowed until healing is further along.",
    videoUrl: null,
    redFlags: ["Vomiting that will not stop", "Fever over 101°F", "Worsening belly pain", "Incision drainage"],
    medlineSearchTags: ["appendectomy recovery", "post op abdominal surgery"],
  },

  hernia_repair_task: {
    id: "hernia_repair_task",
    type: "task",
    title: "Protect Your Hernia Repair",
    text: "When you cough, sneeze, or laugh, hold a pillow against your abdomen if your clinic recommended splinting. Try to avoid constipation and straining by drinking fluids and following the bowel-care advice from your care team.",
    videoUrl: null,
    frequency: "As needed",
    redFlags: ["New bulge", "Worsening pain", "Cannot pass urine", "Vomiting or severe belly swelling"],
    medlineSearchTags: ["ventral hernia repair", "splinting abdomen"],
  },

  gallbladder_removal_education: {
    id: "gallbladder_removal_education",
    type: "education",
    title: "Healing After Gallbladder Removal",
    text: "After laparoscopic gallbladder surgery, some people feel temporary shoulder pain from the gas used during the procedure. Eat light foods at first if your stomach feels unsettled and increase activity gradually as your clinic allows.",
    videoUrl: null,
    redFlags: ["Jaundice", "Gray-colored stools", "Fever", "Severe worsening belly pain"],
    medlineSearchTags: ["laparoscopic cholecystectomy", "gallbladder surgery recovery"],
  },

  hysterectomy_milestone: {
    id: "hysterectomy_milestone",
    type: "milestone",
    title: "Pelvic Rest and Healing Timeline",
    text: "Internal healing after hysterectomy takes time. Follow your clinic’s guidance about pelvic rest and lifting restrictions, and do not put anything in the vagina until your surgeon says it is safe.",
    videoUrl: null,
    redFlags: ["Heavy bleeding", "Foul odor", "Fever", "Severe worsening pelvic pain"],
    medlineSearchTags: ["hysterectomy recovery", "pelvic rest"],
  },

  prostatectomy_task: {
    id: "prostatectomy_task",
    type: "task",
    title: "Catheter and Pelvic Floor Care",
    text: "If you have a catheter, keep the bag below bladder level and follow your clinic’s cleaning instructions. After catheter removal, your team may recommend pelvic floor exercises such as Kegels.",
    videoUrl: null,
    frequency: "Daily",
    redFlags: ["No urine draining", "Fever", "Severe pain", "Catheter not working properly"],
    medlineSearchTags: ["radical prostatectomy", "Foley catheter home care", "Kegel exercises men"],
  },

  c_section_education: {
    id: "c_section_education",
    type: "education",
    title: "Recovering from a C-Section",
    text: "A C-section is major surgery, so rest matters. Avoid heavy lifting, support your abdomen when holding the baby if that helps, and tell someone right away if your mood feels deeply concerning or you feel unsafe.",
    videoUrl: null,
    redFlags: ["Heavy bleeding", "Foul-smelling discharge", "Red painful breast", "Severe depression or scary thoughts"],
    medlineSearchTags: ["C-section recovery", "postpartum care", "maternal warning signs"],
  },

  kidney_stones_education: {
    id: "kidney_stones_education",
    type: "education",
    title: "Hydration for Kidney Stone Recovery",
    text: "Drinking plenty of fluids can help support recovery and reduce the chance of more stones. If your clinic gave you a strainer, use it as instructed so the stone can be checked.",
    videoUrl: null,
    redFlags: ["Fever", "Unable to keep fluids down", "Pain that becomes unbearable", "No urine output"],
    medlineSearchTags: ["passing a kidney stone", "kidney stone hydration"],
  },

  uti_tracking: {
    id: "uti_tracking",
    type: "tracking",
    title: "Track UTI Recovery",
    text: "Take antibiotics exactly as prescribed and keep track of burning, urgency, fever, or back pain. Finish the full antibiotic course unless your prescriber tells you to stop.",
    videoUrl: null,
    frequency: "Daily",
    redFlags: ["Fever", "Back pain", "Vomiting", "Symptoms getting worse instead of better"],
    medlineSearchTags: ["urinary tract infection recovery", "finish antibiotics UTI"],
  },

  // =========================================================
  // CARDIOPULMONARY / CHRONIC CONDITION SUPPORT
  // =========================================================
  heart_failure_tracking: {
    id: "heart_failure_tracking",
    type: "tracking",
    title: "The Daily Weight Check",
    text: "Weigh yourself in the morning after using the bathroom and before eating, using the same scale when possible. Sudden weight gain can mean fluid is building up.",
    videoUrl: null,
    frequency: "Every morning",
    redFlags: ["More than 2 pounds in 1 day", "More than 5 pounds in 1 week", "Worsening shortness of breath", "Swelling increasing quickly"],
    medlineSearchTags: ["heart failure daily weight", "fluid retention symptoms"],
  },

  hypertension_task: {
    id: "hypertension_task",
    type: "task",
    title: "Check Your Blood Pressure at Home",
    text: "Sit quietly for a few minutes before checking your blood pressure. Keep your back supported, feet flat, and arm at heart level. If your clinician asked for a log, write the readings down.",
    videoUrl: null,
    frequency: "As directed",
    medlineSearchTags: ["home blood pressure monitoring", "hypertension care"],
  },

  copd_task: {
    id: "copd_task",
    type: "task",
    title: "Practice Pursed-Lip Breathing",
    text: "Breathe in through your nose, then breathe out slowly through pursed lips. This can help slow breathing and reduce the feeling of air trapping. If you use home oxygen, keep it away from flames and heat sources.",
    videoUrl: null,
    frequency: "Several times daily",
    redFlags: ["Lips turning blue", "Breathing suddenly much harder", "Confusion", "Oxygen safety concern"],
    medlineSearchTags: ["COPD pursed lip breathing", "home oxygen safety"],
  },

  pneumonia_education: {
    id: "pneumonia_education",
    type: "education",
    title: "Clearing Your Lungs",
    text: "Recovery from pneumonia can take time. Drink fluids if allowed, rest, and take prescribed antibiotics exactly as directed. Smoke-free air and moisture in the room may also help some people feel more comfortable.",
    videoUrl: null,
    redFlags: ["Breathing getting harder", "High fever", "Chest pain", "Confusion"],
    medlineSearchTags: ["pneumonia recovery", "finishing antibiotics pneumonia"],
  },

  cpap_cleaning_task: {
    id: "cpap_cleaning_task",
    type: "task",
    title: "Keep Your CPAP Equipment Clean",
    text: "Clean your mask and equipment the way your manufacturer and clinician recommend. Avoid harsh chemicals that could damage the device or leave residue behind.",
    videoUrl: null,
    frequency: "Regular cleaning schedule",
    medlineSearchTags: ["cleaning CPAP equipment", "sleep apnea care"],
  },

  angioplasty_site_tracking: {
    id: "angioplasty_site_tracking",
    type: "tracking",
    title: "Check the Catheter Site",
    text: "If you had a catheter placed through the wrist or groin, look at the site for swelling, bleeding, color changes, or worsening pain. Follow your discharge instructions for lifting and activity.",
    videoUrl: null,
    frequency: "Daily in the early phase",
    redFlags: ["Bleeding that does not stop", "Hand or foot becoming pale", "Numbness", "Rapid swelling"],
    medlineSearchTags: ["angioplasty recovery", "cardiac catheterization site care"],
  },

  // =========================================================
  // NEUROLOGICAL / SYSTEMIC
  // =========================================================
  stroke_tracking: {
    id: "stroke_tracking",
    type: "tracking",
    title: "Stroke Safety and Skin Checks",
    text: "If movement is limited, check the skin on heels, ankles, tailbone, and elbows every day. Keep the home free of fall hazards, and remember the FAST warning signs for stroke.",
    videoUrl: null,
    frequency: "Daily",
    redFlags: ["Face drooping", "Arm weakness", "Speech difficulty", "Time to call 911"],
    medlineSearchTags: ["stroke rehabilitation", "pressure ulcer prevention", "FAST stroke signs"],
  },

  concussion_tracking: {
    id: "concussion_tracking",
    type: "tracking",
    title: "Rest Your Healing Brain",
    text: "Recovery after concussion often means limiting physical strain, screen time, and overstimulating environments. Rest and gradual return should follow the plan from your clinician.",
    videoUrl: null,
    frequency: "Daily",
    redFlags: ["Worsening headache", "Repeated vomiting", "Hard to wake up", "Confusion getting worse"],
    medlineSearchTags: ["concussion recovery", "mild traumatic brain injury"],
  },

  sepsis_recovery_education: {
    id: "sepsis_recovery_education",
    type: "education",
    title: "Recovering After Severe Infection",
    text: "Recovery after sepsis can be slow. It is common to feel weak, mentally tired, or emotionally shaken. Pace yourself, set small goals, and track progress one step at a time.",
    videoUrl: null,
    redFlags: ["Confusion worsening", "Fever returning", "Breathing getting harder", "Symptoms suddenly worsening"],
    medlineSearchTags: ["post sepsis syndrome", "recovery after sepsis"],
  },

  // =========================================================
  // SENSORY / PREVENTIVE / HOME SAFETY
  // =========================================================
  cataract_recovery_education: {
    id: "cataract_recovery_education",
    type: "education",
    title: "Protect Your Healing Eye",
    text: "Wear the eye shield if your clinic told you to, especially while sleeping, and avoid rubbing the eye. Follow the drop schedule and activity instructions from your surgeon.",
    videoUrl: null,
    requiredBoxItems: ["tape"],
    redFlags: ["Vision suddenly worse", "Severe pain", "Lots of redness", "Flashes or curtain-like vision change"],
    medlineSearchTags: ["cataract surgery recovery", "eye shield after cataract surgery"],
  },

  diabetic_foot_task: {
    id: "diabetic_foot_task",
    type: "task",
    title: "Do a Daily Foot Check",
    text: "Look at the tops, bottoms, and between the toes of both feet every day. Use lukewarm water, dry carefully, trim nails straight across, and never walk barefoot.",
    videoUrl: null,
    frequency: "Daily",
    redFlags: ["Cut not healing", "Blister", "Redness", "Drainage or swelling"],
    medlineSearchTags: ["diabetic foot care", "neuropathy safety"],
  },

  gout_flare_education: {
    id: "gout_flare_education",
    type: "education",
    title: "Managing a Gout Flare",
    text: "Rest the joint, stay hydrated, and follow the treatment plan your clinician gave you. Some foods and drinks can make gout worse, so ask your care team if diet changes should be part of your plan.",
    videoUrl: null,
    redFlags: ["Fever", "Joint too painful to move", "Symptoms not improving", "New redness spreading widely"],
    medlineSearchTags: ["gout diet", "gout flare up"],
  },

  sinusitis_task: {
    id: "sinusitis_task",
    type: "task",
    title: "Rinse Your Sinuses Safely",
    text: "If your clinician recommended a nasal rinse, use only distilled, filtered, or previously boiled and cooled water. Clean the rinse device after every use.",
    videoUrl: null,
    frequency: "As directed",
    redFlags: ["High fever", "Facial swelling", "Vision changes", "Symptoms rapidly worsening"],
    medlineSearchTags: ["nasal rinse safety", "sinusitis home care"],
  },

  minor_burn_task: {
    id: "minor_burn_task",
    type: "task",
    title: "Care for a Minor Burn",
    text: "Cool the burn with cool running water, not ice. Clean gently, avoid popping blisters, and cover with a clean nonstick dressing if needed.",
    videoUrl: null,
    frequency: "Keep clean and protected daily",
    requiredBoxItems: ["gauze"],
    redFlags: ["Burn looks infected", "Burn is large", "Severe pain", "Burn on face, hands, feet, or genitals"],
    medlineSearchTags: ["first aid burns", "minor burn care"],
  },

  // =========================================================
  // OPTIONAL FUTURE MILESTONES
  // =========================================================
  milestone_suture_removal: {
    id: "milestone_suture_removal",
    type: "milestone",
    title: "Possible Suture or Staple Follow-Up",
    text: "If your procedure involved sutures or staples, this period may be around the time your clinic evaluates healing and discusses removal when appropriate.",
    videoUrl: null,
    medlineSearchTags: ["suture removal", "staple removal after surgery"],
  },

  milestone_driving: {
    id: "milestone_driving",
    type: "milestone",
    title: "Driving Readiness Check",
    text: "Do not resume driving until your clinic says it is safe, especially if you are taking sedating medication or cannot react comfortably and safely.",
    videoUrl: null,
    medlineSearchTags: ["driving after surgery", "when can i drive after surgery"],
  },
};