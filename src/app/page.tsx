import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">AR Menu</h1>
        <p className="text-lg text-gray-500 mb-8">
          Help restaurants bring their dishes to life in augmented reality.
          Upload photos, generate 3D models, share via QR code.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600 transition-colors"
          >
            Restaurant admin
          </Link>
          <a
            href="https://github.com/koegmaster/ar-menu"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            GitHub
          </a>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-4 text-sm">
          {[
            { icon: "📷", title: "Upload photos", desc: "2–4 angles per dish" },
            { icon: "🎲", title: "Auto 3D model", desc: "Powered by Meshy AI" },
            { icon: "📱", title: "AR in browser", desc: "No app install needed" },
          ].map((item) => (
            <div key={item.title} className="bg-gray-50 rounded-xl p-4">
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="font-medium text-gray-900">{item.title}</p>
              <p className="text-gray-500 text-xs mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
