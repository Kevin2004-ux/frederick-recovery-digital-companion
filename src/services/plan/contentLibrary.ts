// app/backend/src/services/plan/contentLibrary.ts

export interface ContentModule {
  id: string;
  type: 'education' | 'task' | 'tracking' | 'milestone';
  title: string;
  body: string;
  assetUrl?: string;
  durationMinutes?: number;
}

export const CONTENT_LIBRARY: Record<string, ContentModule> = {
  'education_wound_care_basic': {
    id: 'education_wound_care_basic',
    type: 'education',
    title: 'Keep It Clean',
    body: 'Your incision is healing. Keep the area clean and dry. Avoid submerging in water.',
    durationMinutes: 3
  },
  'education_wound_care_sutures': {
    id: 'education_wound_care_sutures',
    type: 'education',
    title: 'Caring for Sutures',
    body: 'You have sutures (stitches). Monitor for redness or pulling sensations. Do not pick at them.',
    durationMinutes: 5
  },
  'task_check_incision': {
    id: 'task_check_incision',
    type: 'task',
    title: 'Daily Incision Check',
    body: 'Look at your incision in the mirror. Is it redder than yesterday? Is there new drainage?',
    durationMinutes: 1
  },
  'education_mobility_crutches': {
    id: 'education_mobility_crutches',
    type: 'education',
    title: 'Crutch Safety 101',
    body: 'Ensure the top of the crutch is 1-2 inches below your armpit. Do not rest your weight on your armpits.',
    durationMinutes: 5
  },
  'education_mobility_gentle': {
    id: 'education_mobility_gentle',
    type: 'education',
    title: 'Gentle Movement',
    body: 'Avoid strenuous activity, but try to walk around the room every 2 hours to promote circulation.',
    durationMinutes: 2
  },
  'track_pain_daily': {
    id: 'track_pain_daily',
    type: 'tracking',
    title: 'Daily Discomfort Log',
    body: 'Rate your overall discomfort today on a scale of 1-10.',
    durationMinutes: 1
  },
  'track_pain_movement': {
    id: 'track_pain_movement',
    type: 'tracking',
    title: 'Movement Pain Log',
    body: 'Rate your pain specifically when moving or changing positions.',
    durationMinutes: 1
  },
  'milestone_follow_up_prep': {
    id: 'milestone_follow_up_prep',
    type: 'milestone',
    title: 'Prepare for Follow-Up',
    body: 'Your appointment is coming up. Write down 3 questions you want to ask your doctor.',
    durationMinutes: 10
  }
};