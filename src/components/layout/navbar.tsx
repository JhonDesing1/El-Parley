import { getCurrentUser, isPremiumUser } from "@/lib/utils/auth"
import { NavbarClient } from "./navbar-client"

export async function Navbar() {
  const user = await getCurrentUser()
  const isPremium = user ? await isPremiumUser() : false

  return <NavbarClient isAuthenticated={!!user} isPremium={isPremium} />
}
