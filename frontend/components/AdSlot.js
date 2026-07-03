'use client';

export function AdLeaderboard() {
  return (
    <div className="w-full flex justify-center my-6">
      <div
        className="bg-gray-100 border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs"
        style={{ width: '728px', height: '90px', maxWidth: '100%' }}
        role="complementary"
        aria-label="Iklan"
      >
        <span>Iklan 728×90</span>
      </div>
    </div>
  );
}

export function AdRectangle() {
  return (
    <div className="flex justify-center my-4">
      <div
        className="bg-gray-100 border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs"
        style={{ width: '300px', height: '250px' }}
        role="complementary"
        aria-label="Iklan"
      >
        <span>Iklan 300×250</span>
      </div>
    </div>
  );
}

export function AdMobile() {
  return (
    <div className="flex justify-center my-4 md:hidden">
      <div
        className="bg-gray-100 border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs"
        style={{ width: '320px', height: '50px', maxWidth: '100%' }}
        role="complementary"
        aria-label="Iklan"
      >
        <span>Iklan Mobile</span>
      </div>
    </div>
  );
}
