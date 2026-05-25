/**
 * Demo participant profile loader.
 *
 * In production: a real loader would hit the platform's user-profile
 * service (or our own caching proxy) and return the bio + display name
 * + start date for the given participant. Until that wiring lands, the
 * dashboard ships a static stub keyed on the IIH demo cohort ids so the
 * personalisation surface has something honest to show.
 *
 * The bios mirror the structure of real `UserProfile.txt` entries from
 * engagement_ml/data/raw — short first-person prose, often medical
 * context, sometimes a starting goal.
 */

import { displayName } from "@/lib/signals";

export type Profile = {
    participantId: string;
    displayName: string;
    bio: string;
    startedAt: string; // ISO
};

const DEMO_PROFILES: Record<string, Omit<Profile, "participantId">> = {
    "iih-coh12-001": {
        displayName: "P1",
        bio: "Recently diagnosed with IIH after months of headaches. Wants to learn how to live well with the condition and build a walking habit despite the pressure changes.",
        startedAt: "2025-11-01T09:00:00Z",
    },
    "iih-coh12-002": {
        displayName: "P2",
        bio: "Living with IIH for three years. Joining the programme to find a community and re-establish a journaling routine after a recent flare-up.",
        startedAt: "2025-11-01T09:00:00Z",
    },
    "iih-coh12-003": {
        displayName: "P3",
        bio: "Returning participant — completed an earlier wellbeing programme. Wants to focus on stress management and the link between sleep and IIH symptoms.",
        startedAt: "2025-11-01T09:00:00Z",
    },
    "iih-coh12-004": {
        displayName: "P4",
        bio: "Joined on a friend's recommendation. Mentioned at sign-up that work travel makes routines hard. No goal set yet.",
        startedAt: "2025-11-01T09:00:00Z",
    },
    "iih-coh12-005": {
        displayName: "P5",
        bio: "Diagnosed last summer; balancing recovery with caring responsibilities. Hopes the programme will help her practise self-compassion during low days.",
        startedAt: "2025-11-01T09:00:00Z",
    },
    "iih-coh12-006": {
        displayName: "P6",
        bio: "Lives in a rural area; chose the online programme to fit around shift work. Active and outdoorsy on good days.",
        startedAt: "2025-11-01T09:00:00Z",
    },
};

export function getDemoProfile(participantId: string): Profile {
    const stub = DEMO_PROFILES[participantId];
    if (stub) return { participantId, ...stub };
    return {
        participantId,
        displayName: displayName(participantId),
        bio: "",
        startedAt: new Date().toISOString(),
    };
}
