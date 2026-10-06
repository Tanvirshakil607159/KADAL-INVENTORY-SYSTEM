import React, { useEffect, useState } from 'react';
import { PackageOpen } from 'lucide-react';

// The desktop framing is presentation only; native window controls stay native.
export default function DesktopBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="desktop-bar">
      <div className="desktop-app-name"><PackageOpen size={16} aria-hidden="true" /><strong>KADAL</strong><span>Inventory workspace</span></div>
      <div className="desktop-bar-right"><span>KA Design Accessories</span><time dateTime={now.toISOString()}>{now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}<span className="desktop-time">{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></time></div>
    </div>
  );
}
