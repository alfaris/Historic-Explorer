import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "h-10 w-10" }) => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" className="text-sand/30" />
    <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" className="text-gold/60" />
    
    {/* Dome */}
    <path d="M 25 60 L 25 40 C 25 32 30 25 40 25 C 50 25 55 32 55 40 L 55 60" fill="currentColor" className="text-nile" />
    <path d="M 40 25 L 40 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-nile" />
    <circle cx="40" cy="5" r="2.5" fill="currentColor" className="text-gold" />

    {/* Base line */}
    <rect x="15" y="60" width="50" height="3" rx="1.5" fill="currentColor" className="text-ink" />

    {/* Arch cutout */}
    <path d="M 33 60 L 33 48 A 6 6 0 0 1 47 48 L 47 60" fill="white" />
  </svg>
);
