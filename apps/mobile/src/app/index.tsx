import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";

/** "/" sends the user to wherever the protected groups allow. */
export default function Index() {
  const { session, profile } = useAuth();
  if (!session) return <Redirect href="/(auth)/phone" />;
  if (!profile?.display_name) return <Redirect href="/(auth)/profile" />;
  return <Redirect href="/(app)/home" />;
}
