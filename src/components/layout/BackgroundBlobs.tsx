import React from 'react';

export const BackgroundBlobs: React.FC = () => {
  return (
    <div className="bg-vector-container">
      <svg className="w-full h-full" viewBox="0 0 400 850" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgPeachGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFC8AF" />
            <stop offset="60%" stopColor="#FEDEC9" />
            <stop offset="100%" stopColor="#FFE8DB" />
          </linearGradient>
          <linearGradient id="bgMintGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#BBEBD3" />
            <stop offset="75%" stopColor="#DDF5EA" />
            <stop offset="100%" stopColor="#F3F8F6" />
          </linearGradient>
          <linearGradient id="bgLavenderGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E2D2F7" />
            <stop offset="70%" stopColor="#EFE4FB" />
            <stop offset="100%" stopColor="#F3F8F6" />
          </linearGradient>
        </defs>

        {/* Base Background */}
        <rect width="400" height="850" fill="#F3F8F6" />

        {/* Top-Left Mint Green Vector Shape (Crisp, Smooth Bezier Curves) */}
        <path d="M 0,0 L 260,0 C 220,110 175,230 110,310 C 50,380 0,420 0,420 Z" fill="url(#bgMintGrad)" opacity="0.95" />

        {/* Top-Right Lavender Purple Vector Shape (Concentric Layered Crisp Curves) */}
        <path d="M 230,0 C 245,70 275,115 325,135 C 365,150 400,105 400,55 L 400,0 Z" fill="#E8DBFA" opacity="0.4" />
        <path d="M 260,0 C 275,55 300,90 345,105 C 375,115 400,85 400,35 L 400,0 Z" fill="url(#bgLavenderGrad)" opacity="0.95" />

        {/* Bottom Peach Wave (Crisp Internal Concave & External Convex Curves) */}
        <path d="M 0,850 L 0,710 C 60,620 120,555 195,575 C 275,595 305,475 335,395 C 365,315 385,335 400,345 L 400,850 Z" fill="url(#bgPeachGrad)" />

        {/* 4-Pointed Star Accent in Bottom-Right */}
        <g transform="translate(330, 765)">
          <path d="M 12,0 Q 12,12 24,12 Q 12,12 12,24 Q 12,12 0,12 Q 12,12 12,0 Z" fill="#F8BAA3" opacity="0.75" />
        </g>
      </svg>
    </div>
  );
};
