import { routes } from "@/lib/routes";
import type { Recommendation, RecoveryLogEntry } from "@/types/log";

export function buildRecommendationsFromLog(entry: RecoveryLogEntry): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (entry.swellingLevel >= 7) {
    recommendations.push({
      id: "swelling-support",
      title: "Review swelling support steps",
      description: "Higher swelling was logged today. Revisit your swelling-control resources and box items.",
      tone: "warning",
      targetRoute: routes.patientMyBox,
    });
  }

  if (entry.details.missedMeds) {
    recommendations.push({
      id: "medication-routine",
      title: "Refresh medication basics",
      description: "A missed dose was noted. Open the medical hub for reminder basics before changing anything.",
      tone: "info",
      targetRoute: routes.patientMedicalHub,
    });
  }

  if (entry.details.redFlags.length > 0) {
    recommendations.push({
      id: "red-flags",
      title: "Escalate red-flag symptoms",
      description: "Your check-in included warning signs. Review your clinic guidance and contact instructions now.",
      tone: "warning",
      targetRoute: routes.patientMedicalHub,
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      id: "keep-going",
      title: "Keep the recovery picture complete",
      description: "Continue daily check-ins so your trends stay useful for you and your care team.",
      tone: "info",
      targetRoute: routes.patientHome,
    });
  }

  return recommendations;
}
