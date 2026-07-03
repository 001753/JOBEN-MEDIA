export default function TagLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5">
        <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        <span className="text-gray-300">/</span>
        <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        <span className="text-gray-300">/</span>
        <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-6">
            <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse mb-2" />
            <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
          </div>

          {/* Ad placeholder */}
          <div className="h-[90px] bg-gray-100 rounded-xl animate-pulse mb-8" />

          {/* 2 grid cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
            {[0, 1].map((i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm">
                <div className="aspect-[16/9] bg-gray-200 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-3 w-16 bg-red-100 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gray-100 rounded animate-pulse mt-2" />
                </div>
              </div>
            ))}
          </div>

          {/* Horizontal list */}
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="py-4 flex gap-4 items-start">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-4/5 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="w-36 h-24 bg-gray-200 rounded-lg animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-[300px] shrink-0 space-y-6">
          <div className="h-[250px] bg-gray-100 rounded-xl animate-pulse" />
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="h-7 bg-gray-100 rounded-full animate-pulse" style={{ width: `${60 + (i % 4) * 20}px` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
