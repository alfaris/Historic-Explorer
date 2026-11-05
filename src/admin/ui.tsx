import React, { lazy } from 'react';
import { LazyBoundary } from '../components/LazyBoundary';
import type { LatLng } from '../components/LocationPicker';

const LocationPickerLazy = lazy(() => import('../components/LocationPicker'));

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-nile text-white hover:bg-nile-light',
    secondary: 'bg-chalk text-ink hover:bg-sand/40',
    danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
  }[variant];
  return (
    <button
      {...props}
      className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles} ${className}`}
    />
  );
}

export function ErrorBox({ message, problems = [], children }: { message: string; problems?: string[]; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-red-50 border border-red-100 text-red-800 text-sm p-4 mb-4" role="alert">
      <p className="font-bold">{message}</p>
      {problems.length > 0 && (
        <ul className="list-disc ps-5 mt-2 space-y-1">
          {problems.slice(0, 20).map(p => (
            <li key={p}>{p}</li>
          ))}
          {problems.length > 20 && <li>…and {problems.length - 20} more</li>}
        </ul>
      )}
      {children}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-stone-500">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="block text-[11px] text-stone-400 mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass = 'w-full rounded-xl border border-sand/60 p-2.5 text-sm bg-white focus:outline-none focus:border-nile';

export function MapPicker(props: { value: LatLng; onChange: (v: LatLng) => void; reference?: LatLng; height?: number }) {
  return (
    <LazyBoundary loading={<div className="h-[260px] rounded-2xl bg-chalk animate-pulse" />} failed={<p className="text-sm text-stone-500">Map couldn’t load; type the coordinates instead.</p>}>
      <LocationPickerLazy {...props} />
    </LazyBoundary>
  );
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
