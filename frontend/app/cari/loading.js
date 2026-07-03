/* Loading skeleton — tampil selama server fetch berlangsung */
export default function SearchLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-1.5 h-8 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-8 w-72 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="h-4 w-40 bg-gray-100 rounded animate-pulse ml-5" />
      </div>

      {/* Search box skeleton */}
      <div className="flex gap-3 max-w-2xl mb-8">
        <div className="flex-1 h-12 bg-gray-100 rounded-xl animate-pulse" />
        <div className="w-24 h-12 bg-red-100 rounded-xl animate-pulse" />
      </div>

      {/* Ad slot skeleton */}
      <div className="h-[90px] bg-gray-100 rounded-xl animate-pulse mb-8" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm">
            <div className="aspect-[16/9] bg-gray-200 animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-3 w-16 bg-red-100 rounded animate-pulse" />
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-4/5 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-24 bg-gray-100 rounded animate-pulse mt-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
