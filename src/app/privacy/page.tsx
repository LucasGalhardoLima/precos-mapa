import { permanentRedirect } from "next/navigation";

// Old URL of the policy; the current one is /privacidade.
export default function PrivacyPage() {
  permanentRedirect("/privacidade");
}
