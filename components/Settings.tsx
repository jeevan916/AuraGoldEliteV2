
import React from 'react';
import { GlobalSettings } from '../types';
import ConfigTab from './settings/ConfigTab';

interface SettingsProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdate }) => {
  const handleUpdateSettings = async (newSettings: GlobalSettings) => {
      onUpdate(newSettings);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn py-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-serif-elite font-black text-slate-900 tracking-tight">System Console</h2>
          <p className="text-slate-500 text-xs mt-2 font-medium">Manage pricing, database connections, and API integrations.</p>
        </div>
      </header>

      <ConfigTab settings={settings} onUpdate={handleUpdateSettings as any} />
    </div>
  );
};

export default Settings;
