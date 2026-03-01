import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

// Hardcoded for MVP — in production this comes from auth session
const DEMO_RESTAURANT_ID = process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID ?? "";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { data: dishes } = await supabase
    .from("dishes")
    .select("model_status")
    .eq("restaurant_id", DEMO_RESTAURANT_ID);

  const counts = {
    total: dishes?.length ?? 0,
    succeeded: dishes?.filter((d) => d.model_status === "succeeded").length ?? 0,
    processing: dishes?.filter((d) => d.model_status === "processing").length ?? 0,
    failed: dishes?.filter((d) => d.model_status === "failed").length ?? 0,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage your restaurant&apos;s AR menu</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total dishes", value: counts.total, color: "text-gray-900" },
          { label: "3D ready", value: counts.succeeded, color: "text-green-600" },
          { label: "Generating", value: counts.processing, color: "text-yellow-600" },
          { label: "Failed", value: counts.failed, color: "text-red-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link
          href="/admin/dishes/new"
          className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add dish
        </Link>
        <Link
          href="/admin/dishes"
          className="inline-flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          View all dishes
        </Link>
      </div>
    </div>
  );
}
