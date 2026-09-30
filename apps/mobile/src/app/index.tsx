import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";

/** "/" sends the user to wherever the protected groups allow. */
export default function Index() {
  const { session, profile, pendingPasswordReset } = useAuth();
  if (!session) return <Redirect href="/(auth)/landing" />;
  if (!session.user.phone) return <Redirect href="/(auth)/add-phone" />;
  if (pendingPasswordReset) return <Redirect href="/(auth)/reset-password" />;
  if (!profile?.display_name) return <Redirect href="/(auth)/profile" />;
  return <Redirect href="/(app)/home" />;
}
