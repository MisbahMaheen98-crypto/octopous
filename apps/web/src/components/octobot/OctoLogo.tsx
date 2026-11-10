
import React from 'react';
import octobotLogo from '../../assets/octobot-logo.png';
interface OctoLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export const OctoLogo: React.FC<OctoLogoProps> = ({
  size = 28,
  className = '',
  showText = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={octobotLogo}
        alt="OCTOBOT Logo"
        width={size}
        height={size}
        className="shrink-0 object-contain"
      />

      {showText && (
        <span className="font-bold tracking-tight text-foreground font-sans">
          OCTOBOT
        </span>
      )}
    </div>
  );
};
