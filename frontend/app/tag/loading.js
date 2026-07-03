export default function AllTagsLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
          <span className="text-gray-300">/</span>
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-red-200 rounded-full" />
          <div className="h-9 w-36 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mt-2 ml-4" />
      </div>

      {/* Alphabet jump */}
      <div className="flex flex-wrap gap-1.5 mb-8 p-4 bg-gray-50 rounded-xl">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Groups */}
      <div className="space-y-10">
        {[5, 8, 4, 6, 3, 7].map((count, gi) => (
          <div key={gi}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-red-100 rounded animate-pulse" />
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="flex flex-wrap gap-2 ml-11">
              {Array.from({ length: count }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 bg-gray-100 rounded-full animate-pulse"
                  style={{ width: `${70 + (i % 3) * 25}px` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
