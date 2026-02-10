
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed select-none";
  
  const variants = {
    primary: "bg-[#007AFF] text-white hover:bg-[#0066D6] shadow-sm",
    secondary: "bg-[#2C2C2E] text-white border border-white/5 hover:bg-[#3A3A3C]",
    glass: "glass text-white hover:bg-white/10 border border-white/10",
    danger: "bg-[#FF3B30] text-white hover:bg-[#D73229]"
  };

  const sizes = {
    sm: "px-4 py-2 text-xs font-bold uppercase tracking-widest",
    md: "px-6 py-3 text-sm",
    lg: "px-10 py-4 text-base"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} 
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-current" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = "" }) => (
  <div className={`apple-card p-6 ${className}`}>
    {children}
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, ...props }) => (
  <div className="w-full space-y-1.5">
    {label && <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/30 ml-1">{label}</label>}
    <input 
      {...props} 
      className={`w-full px-4 py-3 rounded-xl border border-white/5 bg-white/[0.04] text-white outline-none focus:bg-white/[0.08] focus:border-[#007AFF] transition-all duration-200 ${props.className || ''}`}
    />
  </div>
);
