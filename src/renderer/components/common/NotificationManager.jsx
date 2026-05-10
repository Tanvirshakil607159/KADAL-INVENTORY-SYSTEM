import React, { useEffect, useRef } from 'react';
import useStore from '../../store/useStore';

export default function NotificationManager() {
  const { user, addToast, setNotificationDot } = useStore();
  const lastPendingId = useRef(parseInt(localStorage.getItem('last_seen_pending_id') || '0'));
  const seenStatusKeys = useRef(new Set(JSON.parse(localStorage.getItem('seen_status_keys') || '[]')));
  const isFirstRun = useRef(true);
  
  useEffect(() => {
    if (!user) return;

    const checkNotifications = async () => {
      try {
        // 1. Admin: Check for pending approvals → red dot on "approvals"
        if (user.roleName === 'Admin' || user.roleName === 'Super Admin') {
          const pendingRes = await window.kadal.approvals.getAll({ status: 'PENDING' });
          if (pendingRes.success) {
            const hasPending = pendingRes.data.length > 0;
            setNotificationDot('approvals', hasPending);

            // Toast for new requests (skip on first load)
            if (!isFirstRun.current && hasPending) {
              const latest = pendingRes.data[0];
              if (latest.id > lastPendingId.current) {
                addToast('info', `New Approval Request from ${latest.requester_name}`);
                lastPendingId.current = latest.id;
                localStorage.setItem('last_seen_pending_id', latest.id.toString());
              }
            } else if (!isFirstRun.current) {
              // No pending left
            }
            // Update last seen on first run without toast
            if (isFirstRun.current && hasPending) {
              lastPendingId.current = pendingRes.data[0].id;
              localStorage.setItem('last_seen_pending_id', pendingRes.data[0].id.toString());
            }
          }
        }

        // 2. Everyone: Check for status updates on my requests
        const myRes = await window.kadal.approvals.getAll({ requestedBy: user.id });
        if (myRes.success && myRes.data.length > 0) {
          const processed = myRes.data.filter(r => r.status !== 'PENDING');
          
          // Check each processed request for new status changes
          let dotChallan = false;
          let dotInventory = false;
          let dotGatePass = false;

          for (const req of processed) {
            const statusKey = `${req.id}_${req.status}`;
            if (!seenStatusKeys.current.has(statusKey)) {
              // This is a new status change
              if (!isFirstRun.current) {
                const statusLabel = req.status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
                const typeLabel = req.type.replace(/_/g, ' ');
                addToast(req.status === 'APPROVED' ? 'success' : 'error', `Your ${typeLabel} request has been ${statusLabel}`);
              }
              seenStatusKeys.current.add(statusKey);
              
              // Set dots on relevant modules
              if (req.type === 'CREATE_CHALLAN') dotChallan = true;
              if (req.type === 'CREATE_ITEM' || req.type === 'UPDATE_ITEM' || req.type === 'STOCK_MOVEMENT') dotInventory = true;
              if (req.type === 'CREATE_GATE_PASS') dotGatePass = true;
            }
          }

          // Also check for unseen statuses that should still show dots
          // (dots persist until user visits the relevant page)
          const unseenDots = JSON.parse(localStorage.getItem('unseen_dots') || '{}');
          if (dotChallan) unseenDots['challan'] = true;
          if (dotInventory) unseenDots['inventory'] = true;
          if (dotGatePass) unseenDots['gate-pass'] = true;
          localStorage.setItem('unseen_dots', JSON.stringify(unseenDots));

          setNotificationDot('challan', !!unseenDots['challan']);
          setNotificationDot('challan-history', !!unseenDots['challan']);
          setNotificationDot('inventory', !!unseenDots['inventory']);
          setNotificationDot('gate-pass', !!unseenDots['gate-pass']);

          // Save seen keys
          localStorage.setItem('seen_status_keys', JSON.stringify([...seenStatusKeys.current]));
        }
      } catch (err) {
        console.error('Notification check failed', err);
      }

      isFirstRun.current = false;
    };

    // Check immediately on load
    checkNotifications();

    // Then check every 10 seconds
    const interval = setInterval(checkNotifications, 10000);
    return () => clearInterval(interval);
  }, [user, addToast, setNotificationDot]);

  return null;
}
