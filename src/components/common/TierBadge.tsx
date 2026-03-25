'use client';

import { getTierBadge } from '@/data/device_compatibility';

export default function TierBadge({ tier }: { tier: 1 | 2 | 3 }) {
  const badge = getTierBadge(tier);
  const colorMap = {
    green: 'bg-green-100 text-green-800 border-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    red: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorMap[badge.color as keyof typeof colorMap]}`}>
      {badge.label}
    </span>
  );
}
