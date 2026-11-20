import React, { useState } from 'react';
import { Monitor } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';
import { WindowsDesktopModal } from './WindowsDesktopModal';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        title="Download / Install AI VISION for Windows"
        className="comic-btn comic-btn-cyan px-3.5 py-2 rounded-xl text-xs uppercase cursor-pointer"
      >
        <Monitor className="h-4 w-4 text-[#121829]" />
        <span className="whitespace-nowrap">Windows App</span>
      </button>

      <WindowsDesktopModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};
