import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { NotificationOptIn } from "@/components/notifications/notification-opt-in";
import { getCurrentUser } from "@/lib/utils/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      <Footer />
      {user && <NotificationOptIn userId={user.id} />}
    </>
  );
}
