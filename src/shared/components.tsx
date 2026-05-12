import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

export const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
      active ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:bg-surface-zen'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium flex-1 text-left">{label}</span>
    {badge != null && (
      <span className="bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full">{badge}</span>
    )}
  </button>
);

export const Modal = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl"
    >
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-primary-dark">{title}</h3>
        <button onClick={onClose} className="text-text-secondary hover:text-error-zen"><X size={20} /></button>
      </div>
      {children}
    </motion.div>
  </div>
);

export const Input = ({ label, value, onChange, type = 'text', placeholder, className }: any) => (
  <div className={className}>
    {label && <label className="text-sm text-text-secondary font-medium block mb-1">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all bg-white"
    />
  </div>
);

export const Select = ({ label, value, onChange, options, className }: any) => (
  <div className={className}>
    {label && <label className="text-sm text-text-secondary font-medium block mb-1">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all bg-white"
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

export const StatCard = ({ icon: Icon, label, value, color = 'primary', sub }: any) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-surface-zen hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-text-secondary font-medium">{label}</span>
      <div className={`w-10 h-10 bg-${color}/10 text-${color} rounded-lg flex items-center justify-center`}>
        <Icon size={20} />
      </div>
    </div>
    <div className="text-2xl font-bold text-text-main">{value}</div>
    {sub && <div className="text-xs text-text-secondary mt-1">{sub}</div>}
  </div>
);

export const TabButton = ({ label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      active ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:bg-surface-zen'
    }`}
  >
    {label}
  </button>
);
