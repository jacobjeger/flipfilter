'use client';

interface Props {
  status: 'success' | 'error' | 'warning' | 'loading' | 'idle';
  label: string;
  detail?: string;
}

export default function StatusIndicator({ status, label, detail }: Props) {
  const icons: Record<string, string> = {
    success: '✓',
    error: '✗',
    warning: '!',
    loading: '◌',
    idle: '○',
  };

  const colors: Record<string, string> = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    loading: 'text-blue-600 animate-spin',
    idle: 'text-gray-400',
  };

  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`text-lg font-bold ${colors[status]}`}>{icons[status]}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {detail && <span className="text-xs text-gray-500">({detail})</span>}
    </div>
  );
}
