import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, placeholder, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
      <input
        type="text"
        placeholder={placeholder}
        // text-base (16px) prevents iOS zoom on focus
        className="w-full pl-10 p-3 rounded-xl bg-gray-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary outline-none text-base"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
};
