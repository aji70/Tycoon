import type { Metadata } from "next";
import AdminDashboardLayout from "@/components/admin/dashboard/AdminDashboardLayout";

export const metadata: Metadata = {
  title: "Admin · Tycoon",
  description: "Tycoon platform administration",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminDashboardLayout>{children}</AdminDashboardLayout>;
}
